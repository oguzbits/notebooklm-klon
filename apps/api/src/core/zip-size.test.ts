import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { zipUncompressedBytes } from './zip-size';

const text = (length: number) => new TextEncoder().encode('a'.repeat(length));

describe('zipUncompressedBytes', () => {
  it('sums the declared sizes of all entries, however small the file is', () => {
    const zip = zipSync({ 'a.xml': text(1000), 'dir/b.xml': text(2000) });

    expect(zipUncompressedBytes(zip)).toBe(3000);
    expect(zip.length).toBeLessThan(500);
  });

  it('finds the directory when bytes follow the end record', () => {
    const zip = zipSync({ 'a.xml': text(10) });
    const tail = new Uint8Array(zip.length + 40);
    tail.set(zip);

    expect(zipUncompressedBytes(tail)).toBe(10);
  });

  it('returns null for bytes that are no ZIP or whose directory is cut off', () => {
    const zip = zipSync({ 'a.xml': text(10) });

    expect(
      zipUncompressedBytes(new TextEncoder().encode('not a zip at all, just text'))
    ).toBeNull();
    expect(zipUncompressedBytes(zip.slice(0, zip.length - 30))).toBeNull();
  });
});
