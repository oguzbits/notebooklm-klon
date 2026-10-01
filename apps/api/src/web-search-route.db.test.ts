import {
  API_ERROR,
  ApiErrorSchema,
  CapabilitiesSchema,
  WebSearchResponseSchema,
} from '@nlm/shared';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app';
import { LIMITS } from './config/limits';
import { WebSearchError } from './search/tavily-search';
import { BASE_URL, createHarness } from './testing/app-harness';

const PASSWORD = 'correct-horse-battery';
const RESULT = {
  title: 'RAG – Wikipedia',
  url: 'https://de.wikipedia.org/wiki/RAG',
  snippet: 'Text.',
};

const searched: string[] = [];
const available = createHarness({
  webSearch: {
    search: async (query) => {
      searched.push(query);
      return [RESULT];
    },
  },
});
const availableApp = createApp(available.deps);
const unavailable = createHarness();
const unavailableApp = createApp(unavailable.deps);

async function signUp(harness: ReturnType<typeof createHarness>, email: string) {
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

let alice: string;
let bob: string;

beforeEach(async () => {
  await available.pool.query('TRUNCATE "user" CASCADE');
  searched.length = 0;
  alice = await signUp(available, 'alice@example.test');
  bob = await signUp(available, 'bob@example.test');
});

afterAll(async () => {
  await available.pool.end();
  await unavailable.pool.end();
});

describe('POST /api/web-search', () => {
  it('answers pages for a query', async () => {
    const response = await availableApp.request(
      '/api/web-search',
      post(alice, { query: 'RAG erklärt' })
    );

    expect(response.status).toBe(200);
    expect(WebSearchResponseSchema.parse(await response.json()).results).toEqual([RESULT]);
    expect(searched).toEqual(['RAG erklärt']);
  });

  it('needs a signed-in user and a valid query, and never searches without them', async () => {
    const anonymous = await availableApp.request('/api/web-search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'RAG' }),
    });
    const tooShort = await availableApp.request('/api/web-search', post(alice, { query: ' ' }));

    expect(anonymous.status).toBe(401);
    expect(tooShort.status).toBe(400);
    expect(searched).toEqual([]);
  });

  it('answers 503 where the search is not set up', async () => {
    const cookie = await signUp(unavailable, 'carla@example.test');

    const response = await unavailableApp.request(
      '/api/web-search',
      post(cookie, { query: 'RAG' })
    );

    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(API_ERROR.WEB_SEARCH_UNAVAILABLE);
    await unavailable.pool.query('TRUNCATE "user" CASCADE');
  });

  it('gives each user a few searches an hour', async () => {
    for (let i = 0; i < LIMITS.WEB_SEARCHES_PER_USER_PER_HOUR; i += 1) {
      const response = await availableApp.request(
        '/api/web-search',
        post(alice, { query: `Frage ${i}` })
      );
      expect(response.status).toBe(200);
    }

    const refused = await availableApp.request(
      '/api/web-search',
      post(alice, { query: 'noch eine' })
    );
    const other = await availableApp.request('/api/web-search', post(bob, { query: 'Bob fragt' }));

    expect(refused.status).toBe(429);
    expect(ApiErrorSchema.parse(await refused.json()).code).toBe(
      API_ERROR.WEB_SEARCH_LIMIT_REACHED
    );
    expect(other.status).toBe(200);
    expect(searched).not.toContain('noch eine');
  });

  it('answers 429 when the search service says its quota is used up', async () => {
    const used = createHarness({
      webSearch: {
        search: async () => {
          throw new WebSearchError(432, true);
        },
      },
    });
    const usedApp = createApp(used.deps);
    const cookie = await signUp(used, 'dora@example.test');

    const response = await usedApp.request('/api/web-search', post(cookie, { query: 'RAG' }));

    expect(response.status).toBe(429);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      API_ERROR.WEB_SEARCH_LIMIT_REACHED
    );
    await used.pool.end();
  });

  it('answers 500 for any other failure of the search service', async () => {
    const broken = createHarness({
      webSearch: {
        search: async () => {
          throw new WebSearchError(401, false);
        },
      },
    });
    const brokenApp = createApp(broken.deps);
    const cookie = await signUp(broken, 'emil@example.test');

    const response = await brokenApp.request('/api/web-search', post(cookie, { query: 'RAG' }));

    expect(response.status).toBe(500);
    await broken.pool.end();
  });
});

describe('GET /api/capabilities', () => {
  it('says whether the web search is set up', async () => {
    const yes = await availableApp.request('/api/capabilities', { headers: { cookie: alice } });
    const cookie = await signUp(unavailable, 'fritz@example.test');
    const no = await unavailableApp.request('/api/capabilities', { headers: { cookie } });

    expect(CapabilitiesSchema.parse(await yes.json())).toEqual({ webSearch: true });
    expect(CapabilitiesSchema.parse(await no.json())).toEqual({ webSearch: false });
    await unavailable.pool.query('TRUNCATE "user" CASCADE');
  });

  it('is for signed-in users only', async () => {
    expect((await availableApp.request('/api/capabilities')).status).toBe(401);
  });
});
