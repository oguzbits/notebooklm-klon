import { BlockList, isIP } from 'node:net';

/** Why an import URL was refused before any request was made. */
export const URL_REJECTION = {
  MALFORMED: 'MALFORMED',
  SCHEME: 'SCHEME',
  CREDENTIALS: 'CREDENTIALS',
  LOCAL_HOST: 'LOCAL_HOST',
  PRIVATE_ADDRESS: 'PRIVATE_ADDRESS',
} as const;

export type UrlRejection = (typeof URL_REJECTION)[keyof typeof URL_REJECTION];

export type ParsedImportUrl = { ok: true; url: URL } | { ok: false; reason: UrlRejection };

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const LOCAL_HOST_SUFFIXES = ['.localhost', '.local', '.internal'];

const IPV4 = 'ipv4';
const IPV6 = 'ipv6';

// Loopback, private, link-local, carrier-grade NAT, documentation, benchmarking, multicast and
// reserved ranges. BlockList also matches an IPv4 address written as an IPv4-mapped IPv6 address.
const NON_PUBLIC = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 3],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, IPV4);
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, IPV6);
}

/** True only for a syntactically valid IP address that is routable on the public internet. */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) return false;
  return !NON_PUBLIC.check(address, version === 4 ? IPV4 : IPV6);
}

/**
 * First line of defence for URL import: only http and https, no credentials, no local host names
 * and no literal private address. The URL parser already normalizes alternative spellings such as
 * `2130706433` or `127.1`. Host names that resolve to private addresses are caught later, when the
 * resolved address is checked with {@link isPublicAddress}, on every redirect.
 */
export function parseImportUrl(input: string): ParsedImportUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch (error) {
    // The URL constructor throws a TypeError for anything that is not an absolute URL.
    if (error instanceof TypeError) return { ok: false, reason: URL_REJECTION.MALFORMED };
    throw error;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return { ok: false, reason: URL_REJECTION.SCHEME };
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: URL_REJECTION.CREDENTIALS };
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(host) !== 0) {
    return isPublicAddress(host)
      ? { ok: true, url }
      : { ok: false, reason: URL_REJECTION.PRIVATE_ADDRESS };
  }
  if (host === 'localhost' || LOCAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, reason: URL_REJECTION.LOCAL_HOST };
  }
  return { ok: true, url };
}
