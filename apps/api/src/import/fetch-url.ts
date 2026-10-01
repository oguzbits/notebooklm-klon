import { isIP } from 'node:net';

import { LIMITS } from '../config/limits';
import { isPublicAddress, parseImportUrl, URL_REJECTION } from '../core/ssrf';

export const IMPORT_ERROR = {
  INVALID_URL: 'IMPORT_INVALID_URL',
  PRIVATE_ADDRESS: 'IMPORT_ADDRESS_NOT_PUBLIC',
  DNS_FAILED: 'IMPORT_DNS_FAILED',
  TOO_MANY_REDIRECTS: 'IMPORT_TOO_MANY_REDIRECTS',
  HTTP_STATUS: 'IMPORT_HTTP_STATUS',
  UNSUPPORTED_CONTENT_TYPE: 'IMPORT_UNSUPPORTED_CONTENT_TYPE',
  TOO_LARGE: 'IMPORT_TOO_LARGE',
  TIMEOUT: 'IMPORT_TIMEOUT',
} as const;

export type ImportErrorCode = (typeof IMPORT_ERROR)[keyof typeof IMPORT_ERROR];

/** A refused or failed import. The code is stable, the message never contains page content. */
export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = 'ImportError';
  }
}

export interface FetchedPage {
  finalUrl: string;
  /** Media type without parameters, lower case. */
  contentType: string;
  body: Uint8Array;
}

export interface FetchDeps {
  /** All addresses of a host name. */
  lookup: (hostname: string) => Promise<string[]>;
  /**
   * One request without following redirects, connected to exactly this address so a second DNS
   * answer cannot swap in a private one between check and connect.
   */
  request: (url: URL, address: string, signal: AbortSignal) => Promise<Response>;
}

const ACCEPTED_TYPES = new Set(['text/html', 'application/xhtml+xml', 'text/plain']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

function rejectionToError(reason: string): ImportError {
  const isPrivate = reason === URL_REJECTION.PRIVATE_ADDRESS || reason === URL_REJECTION.LOCAL_HOST;
  return new ImportError(
    isPrivate ? IMPORT_ERROR.PRIVATE_ADDRESS : IMPORT_ERROR.INVALID_URL,
    isPrivate ? 'The address is not public.' : 'The URL is not a valid http or https URL.'
  );
}

async function publicAddress(url: URL, deps: FetchDeps): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0) return host;

  let addresses: string[];
  try {
    addresses = await deps.lookup(host);
  } catch (error) {
    throw new ImportError(IMPORT_ERROR.DNS_FAILED, 'The host name could not be resolved.', error);
  }
  const [first] = addresses;
  if (first === undefined) {
    throw new ImportError(IMPORT_ERROR.DNS_FAILED, 'The host name could not be resolved.');
  }
  if (!addresses.every(isPublicAddress)) {
    throw new ImportError(IMPORT_ERROR.PRIVATE_ADDRESS, 'The address is not public.');
  }
  return first;
}

async function readBody(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > LIMITS.URL_IMPORT_MAX_BYTES) {
    await response.body?.cancel();
    throw new ImportError(IMPORT_ERROR.TOO_LARGE, 'The page is too large.');
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITS.URL_IMPORT_MAX_BYTES) {
      await reader.cancel();
      throw new ImportError(IMPORT_ERROR.TOO_LARGE, 'The page is too large.');
    }
    parts.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  return body;
}

/** One request to the checked address; running out of time is a stable error of its own. */
async function requestOnce(
  url: URL,
  address: string,
  deps: FetchDeps,
  signal: AbortSignal
): Promise<Response> {
  try {
    return await deps.request(url, address, signal);
  } catch (error) {
    if (error instanceof DOMException && ['TimeoutError', 'AbortError'].includes(error.name)) {
      throw new ImportError(IMPORT_ERROR.TIMEOUT, 'The page took too long to answer.');
    }
    throw error;
  }
}

/** Where a redirect leads, as an address; a redirect without a target is an error. */
async function redirectTarget(response: Response, from: URL): Promise<string> {
  const location = response.headers.get('location');
  await response.body?.cancel();
  if (location === null) {
    throw new ImportError(IMPORT_ERROR.HTTP_STATUS, 'A redirect had no target.');
  }
  return new URL(location, from).href;
}

/** The media type of an answer that may be imported (lower case, no parameters); anything else is refused. */
async function acceptedContentType(response: Response): Promise<string> {
  const ok = response.status >= HTTP_OK_MIN && response.status <= HTTP_OK_MAX;
  if (!ok) {
    await response.body?.cancel();
    throw new ImportError(IMPORT_ERROR.HTTP_STATUS, `The page answered with ${response.status}.`);
  }
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!ACCEPTED_TYPES.has(contentType.toLowerCase())) {
    await response.body?.cancel();
    throw new ImportError(IMPORT_ERROR.UNSUPPORTED_CONTENT_TYPE, 'The page is not text.');
  }
  return contentType.toLowerCase();
}

/**
 * Fetches a public web page. Every hop, the first request and each redirect, goes through the same
 * checks: http(s) only, no credentials, and every address the host resolves to must be public.
 * Redirects, time and size are capped. Nothing is retried and nothing falls back.
 */
export async function fetchPublicUrl(input: string, deps: FetchDeps): Promise<FetchedPage> {
  const signal = AbortSignal.timeout(LIMITS.URL_IMPORT_TIMEOUT_MS);
  let target = input;

  for (let hop = 0; hop <= LIMITS.URL_IMPORT_MAX_REDIRECTS; hop += 1) {
    const parsed = parseImportUrl(target);
    if (!parsed.ok) throw rejectionToError(parsed.reason);
    const address = await publicAddress(parsed.url, deps);
    const response = await requestOnce(parsed.url, address, deps, signal);

    if (REDIRECT_STATUSES.has(response.status)) {
      target = await redirectTarget(response, parsed.url);
      continue;
    }
    const contentType = await acceptedContentType(response);
    return { finalUrl: parsed.url.href, contentType, body: await readBody(response) };
  }
  throw new ImportError(IMPORT_ERROR.TOO_MANY_REDIRECTS, 'Too many redirects.');
}
