import { describe, expect, it } from 'vitest';

import { isPublicAddress, parseImportUrl, URL_REJECTION } from './ssrf';

describe('isPublicAddress', () => {
  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111', '2a00:1450:4001::200e'])(
    'accepts the public address %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    }
  );

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1',
    '127.0.0.1',
    '127.1.2.3',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.0.2.1',
    '192.168.1.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
  ])('rejects the private or reserved IPv4 address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
    '64:ff9b::a00:1',
    '::ffff:127.0.0.1',
    '::ffff:10.1.2.3',
    '::ffff:a9fe:a9fe',
  ])('rejects the private or reserved IPv6 address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it('accepts a public IPv4 address inside an IPv6 mapping', () => {
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });

  it('rejects anything that is not an IP address', () => {
    expect(isPublicAddress('example.com')).toBe(false);
    expect(isPublicAddress('')).toBe(false);
    expect(isPublicAddress('999.1.1.1')).toBe(false);
  });
});

describe('parseImportUrl', () => {
  it('accepts http and https URLs', () => {
    expect(parseImportUrl('https://example.com/a?b=1')).toMatchObject({
      ok: true,
      url: new URL('https://example.com/a?b=1'),
    });
    expect(parseImportUrl('http://example.com')).toMatchObject({ ok: true });
  });

  it.each([
    'ftp://example.com/file',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'data:text/plain,hello',
    'gopher://example.com',
  ])('rejects the scheme of %s', (input) => {
    expect(parseImportUrl(input)).toEqual({ ok: false, reason: URL_REJECTION.SCHEME });
  });

  it.each(['not a url', '', '//example.com', 'example.com'])('rejects %s as malformed', (input) => {
    expect(parseImportUrl(input)).toEqual({ ok: false, reason: URL_REJECTION.MALFORMED });
  });

  it('rejects credentials in the URL', () => {
    expect(parseImportUrl('https://user:pass@example.com')).toEqual({
      ok: false,
      reason: URL_REJECTION.CREDENTIALS,
    });
  });

  it.each(['http://127.0.0.1/admin', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data'])(
    'rejects the literal private address in %s before any lookup',
    (input) => {
      expect(parseImportUrl(input)).toEqual({ ok: false, reason: URL_REJECTION.PRIVATE_ADDRESS });
    }
  );

  it.each([
    'http://localhost/',
    'http://LOCALHOST:8080/',
    'http://foo.localhost/',
    'http://x.local/',
  ])('rejects the local host name in %s', (input) => {
    expect(parseImportUrl(input)).toEqual({ ok: false, reason: URL_REJECTION.LOCAL_HOST });
  });

  it('sees through alternative spellings of a private IPv4 address', () => {
    expect(parseImportUrl('http://2130706433/')).toEqual({
      ok: false,
      reason: URL_REJECTION.PRIVATE_ADDRESS,
    });
    expect(parseImportUrl('http://0x7f.0.0.1/')).toEqual({
      ok: false,
      reason: URL_REJECTION.PRIVATE_ADDRESS,
    });
    expect(parseImportUrl('http://127.1/')).toEqual({
      ok: false,
      reason: URL_REJECTION.PRIVATE_ADDRESS,
    });
  });
});
