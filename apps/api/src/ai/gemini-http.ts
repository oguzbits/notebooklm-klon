import { LIMITS } from '../config/limits';
import { GeminiError } from './gemini-error';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 2000;
const MAX_REASON_CHARS = 200;
const MS_PER_SECOND = 1000;

export interface GeminiHttp {
  apiKey: string;
  /** Waits between retries. Injectable so tests do not wait. */
  sleep: (ms: number) => Promise<void>;
  /** Longest wait for one attempt, answer body included. Without it a stalled call never ends. */
  timeoutMs?: number | undefined;
}

async function reasonOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const error = body.error;
      if (typeof error === 'object' && error !== null && 'message' in error) {
        return String(error.message).slice(0, MAX_REASON_CHARS);
      }
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  return response.statusText;
}

function waitFor(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get('retry-after'));
  return seconds > 0 ? seconds * MS_PER_SECOND : DEFAULT_BACKOFF_MS * 2 ** attempt;
}

function attemptSignal(signal: AbortSignal | undefined, timeoutMs: number | undefined) {
  const active = [signal, timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs)];
  const signals = active.filter((candidate) => candidate !== undefined);
  return signals.length > 0 ? AbortSignal.any(signals) : undefined;
}

/** Resolves when the wait is over and rejects as soon as the signal aborts. */
function sleepUnless(http: GeminiHttp, ms: number, signal?: AbortSignal): Promise<void> {
  if (!signal) return http.sleep(ms);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    http
      .sleep(ms)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * POSTs to a Gemini endpoint and returns the response. A 429 or 503 is retried twice with the wait
 * the provider asks for (at most `LIMITS.RETRY_MAX_WAIT_MS`); every other error status, a longer
 * wait, and the last failed retry throw. The signal ends the request and the wait; `timeoutMs`
 * limits each attempt.
 */
export async function requestGemini(
  http: GeminiHttp,
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'POST',
      headers: { 'x-goog-api-key': http.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: attemptSignal(signal, http.timeoutMs),
    });
    if (response.ok) return response;
    const wait = waitFor(response, attempt);
    if (
      RETRY_STATUSES.has(response.status) &&
      attempt < MAX_RETRIES &&
      wait <= LIMITS.RETRY_MAX_WAIT_MS
    ) {
      await sleepUnless(http, wait, signal);
      continue;
    }
    throw new GeminiError(
      response.status,
      `Gemini request failed with status ${response.status}: ${await reasonOf(response)}`
    );
  }
}

/** Like {@link requestGemini}, for calls that answer with one JSON body. */
export async function postGemini(
  http: GeminiHttp,
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<unknown> {
  const response = await requestGemini(http, path, body, signal);
  return response.json();
}
