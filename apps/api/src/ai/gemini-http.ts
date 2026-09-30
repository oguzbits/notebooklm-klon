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

/**
 * POSTs to a Gemini endpoint and returns the response. A 429 or 503 is retried twice with the wait
 * the provider asks for; every other error status, and the last failed retry, throws.
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
      signal,
    });
    if (response.ok) return response;
    if (RETRY_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      await http.sleep(waitFor(response, attempt));
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
