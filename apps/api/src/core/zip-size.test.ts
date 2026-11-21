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

  it('reads every entry when an earlier one carries a long extra field and comment', () => {
    // 300 bytes need both bytes of the 16-bit lengths, so a wrong byte order moves the next entry.
    const zip = zipSync({
      'a.xml': [text(1000), { extra: { 0x9999: new Uint8Array(300) }, comment: 'c'.repeat(300) }],
      'b.xml': text(2000),
    });

    expect(zipUncompressedBytes(zip)).toBe(3000);
  });

  it('returns null when the directory points past the data or at no entry', () => {
    const zip = zipSync({ 'a.xml': text(10) });
    const endRecord = zip.length - 22;
    const pointTo = (offset: number) => {
      const copy = zip.slice();
      new DataView(copy.buffer).setUint32(endRecord + 16, offset, true);
      return copy;
    };
    const claimTwoEntries = zip.slice();
    new DataView(claimTwoEntries.buffer).setUint16(endRecord + 10, 2, true);

    expect(zipUncompressedBytes(pointTo(zip.length - 2))).toBeNull();
    expect(zipUncompressedBytes(pointTo(0))).toBeNull();
    expect(zipUncompressedBytes(claimTwoEntries)).toBeNull();
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
