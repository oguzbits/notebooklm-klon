import { describe, expect, it } from 'vitest';

import { hashContent } from './content-hash';

// FIPS 180-2 test vector for SHA-256("abc")
const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('hashContent', () => {
  it('returns the SHA-256 of the content as lower-case hex', () => {
    expect(hashContent(new TextEncoder().encode('abc'))).toBe(ABC_SHA256);
  });

  it('is identical for identical bytes and different otherwise', () => {
    const first = new Uint8Array([1, 2, 3]);

    expect(hashContent(first)).toBe(hashContent(new Uint8Array([1, 2, 3])));
    expect(hashContent(first)).not.toBe(hashContent(new Uint8Array([1, 2, 4])));
  });

  it('hashes the empty content', () => {
    expect(hashContent(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });
});
