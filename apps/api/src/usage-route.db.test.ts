import {
  API_ERROR,
  ApiErrorSchema,
  NotebookSchema,
  STUDIO_KIND,
  USAGE_PURPOSE,
  USAGE_ROLE,
  UsageStatusSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app';
import { LIMITS } from './config/limits';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'ein-sicheres-passwort';
const HOUR_MS = 3_600_000;

const harness = createHarness();
const app = createApp(harness.deps);

async function signUp(email: string): Promise<string> {
  const response = await harness.auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ name: email, email, password: PASSWORD }),
    })
  );
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');
}

const post = (cookie: string, body: unknown) => ({
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

async function createNotebook(cookie: string): Promise<string> {
  const response = await app.request('/api/notebooks', post(cookie, { title: 'N' }));
  return NotebookSchema.parse(await response.json()).id;
}

/** Writes uses the way the model adapters do, `count` of them, the first `ageMs` old. */
async function use(
  email: string,
  purpose: typeof USAGE_PURPOSE.CHAT | typeof USAGE_PURPOSE.STUDIO,
  count: number,
  options: { ageMs?: number; tokens?: number } = {}
) {
  const owner = await harness.pool.query('SELECT id FROM "user" WHERE email = $1', [email]);
  for (let i = 0; i < count; i += 1) {
    await harness.pool.query(
      `INSERT INTO usage_events (user_id, purpose, role, input_tokens, output_tokens, estimated, created_at)
       VALUES ($1, $2, $3, $4, 0, false, now() - ($5 || ' milliseconds')::interval)`,
      [
        owner.rows[0].id,
        purpose,
        USAGE_ROLE.CHAT,
        options.tokens ?? 100,
        String(options.ageMs ?? HOUR_MS),
      ]
    );
  }
}

let alice: string;

beforeEach(async () => {
  await harness.pool.query('TRUNCATE "user" CASCADE');
  harness.modelInputs.length = 0;
  alice = await signUp('alice@example.test');
});

afterAll(async () => {
  await harness.pool.end();
});

describe('GET /api/usage', () => {
  it('needs a session', async () => {
    expect((await app.request('/api/usage')).status).toBe(401);
  });

  it('tells how much of each limit the user used', async () => {
    await use('alice@example.test', USAGE_PURPOSE.CHAT, 4);

    const response = await app.request('/api/usage', { headers: { cookie: alice } });

    expect(response.status).toBe(200);
    expect(UsageStatusSchema.parse(await response.json())).toMatchObject({
      chat: { used: 4, limit: LIMITS.CHAT_QUESTIONS_PER_WINDOW, releaseAt: null },
      studio: { used: 0 },
      budgetReached: false,
    });
  });
});

describe('the limits on the requests that cost', () => {
  it('refuses a question over the limit with the time it frees up, and never calls the model', async () => {
    const notebook = await createNotebook(alice);
    await use('alice@example.test', USAGE_PURPOSE.CHAT, LIMITS.CHAT_QUESTIONS_PER_WINDOW);

    const response = await app.request(
      `/api/notebooks/${notebook}/chat`,
      post(alice, { question: 'Wer leitet es?' })
    );

    expect(response.status).toBe(429);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.code).toBe(API_ERROR.USAGE_LIMIT_REACHED);
    const releaseAt = new Date(body.detail ?? '').getTime();
    // The oldest use is an hour old, so the next one is possible in 23 hours.
    expect(releaseAt - Date.now()).toBeGreaterThan(22.9 * HOUR_MS);
    expect(releaseAt - Date.now()).toBeLessThan(23.1 * HOUR_MS);
    expect(harness.modelInputs).toEqual([]);
  });

  it('refuses a Studio output over its own limit, which is counted apart from the questions', async () => {
    const notebook = await createNotebook(alice);
    await use('alice@example.test', USAGE_PURPOSE.STUDIO, LIMITS.STUDIO_OUTPUTS_PER_WINDOW);

    const response = await app.request(
      `/api/notebooks/${notebook}/studio`,
      post(alice, { kind: STUDIO_KIND.FLASHCARDS })
    );

    expect(response.status).toBe(429);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.USAGE_LIMIT_REACHED);
    expect(harness.modelInputs).toEqual([]);
  });

  it('refuses a new source once the budget of the day is used up, for every user', async () => {
    const notebook = await createNotebook(alice);
    await signUp('bob@example.test');
    await use('bob@example.test', USAGE_PURPOSE.CHAT, 1, { tokens: LIMITS.DAILY_TOKEN_BUDGET });
    const form = new FormData();
    form.set('file', new File(['Text'], 'a.txt'));

    const response = await app.request(`/api/notebooks/${notebook}/sources/file`, {
      method: 'POST',
      headers: { cookie: alice },
      body: form,
    });

    expect(response.status).toBe(429);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.DAILY_BUDGET_REACHED);
    expect(harness.enqueued).toEqual([]);
  });
});
