import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { zipUnpackedBytes } from './zip-size';

const text = (length: number) => new TextEncoder().encode('a'.repeat(length));
const LIMIT = 1_000_000;
/** The offsets of the single part of a ZIP made from one file called a.xml. */
const NAME = 'a.xml';
const LOCAL_SIZE_AT = 22;
const DATA_AT = 30 + NAME.length;

const viewOf = (zip: Uint8Array) => new DataView(zip.buffer);
const endRecordOf = (zip: Uint8Array) => zip.length - 22;
const centralOf = (zip: Uint8Array) => viewOf(zip).getUint32(endRecordOf(zip) + 16, true);

describe('zipUnpackedBytes', () => {
  it('sums what all parts unpack to, however small the file is', () => {
    const zip = zipSync({ 'a.xml': text(1000), 'dir/b.xml': text(2000) });

    expect(zipUnpackedBytes(zip, LIMIT)).toBe(3000);
    expect(zip.length).toBeLessThan(500);
  });

  it('counts a part that is only stored', () => {
    const zip = zipSync({ [NAME]: [text(10), { level: 0 }] });

    expect(zipUnpackedBytes(zip, LIMIT)).toBe(10);
  });

  it('reads every part when an earlier one carries a long extra field and comment', () => {
    // 300 bytes need both bytes of the 16-bit lengths, so a wrong byte order moves the next part.
    const zip = zipSync({
      'a.xml': [text(1000), { extra: { 0x9999: new Uint8Array(300) }, comment: 'c'.repeat(300) }],
      'b.xml': text(2000),
    });

    expect(zipUnpackedBytes(zip, LIMIT)).toBe(3000);
  });

  it('counts what a part really unpacks to when its header declares far less', () => {
    const zip = zipSync({ [NAME]: text(2_000_000) });
    viewOf(zip).setUint32(LOCAL_SIZE_AT, 1000, true);
    viewOf(zip).setUint32(centralOf(zip) + 24, 1000, true);

    expect(zipUnpackedBytes(zip, LIMIT)).toBeGreaterThan(LIMIT);
  });

  it('stops inflating soon after the limit instead of unpacking everything', () => {
    const real = 30_000_000;
    const zip = zipSync({ [NAME]: new Uint8Array(real) });

    const counted = zipUnpackedBytes(zip, LIMIT);

    expect(counted).toBeGreaterThan(LIMIT);
    expect(counted).toBeLessThan(real);
  });

  it('adds up across parts: a second part pushes the total over the limit', () => {
    const zip = zipSync({ 'a.xml': text(600_000), 'b.xml': text(600_000) });

    expect(zipUnpackedBytes(zip, LIMIT)).toBe(1_200_000);
  });

  it('returns null when the directory points past the data or at no entry', () => {
    const zip = zipSync({ [NAME]: text(10) });
    const pointTo = (offset: number) => {
      const copy = zip.slice();
      viewOf(copy).setUint32(endRecordOf(copy) + 16, offset, true);
      return copy;
    };
    const claimTwoEntries = zip.slice();
    viewOf(claimTwoEntries).setUint16(endRecordOf(zip) + 10, 2, true);

    expect(zipUnpackedBytes(pointTo(zip.length - 2), LIMIT)).toBeNull();
    expect(zipUnpackedBytes(pointTo(0), LIMIT)).toBeNull();
    expect(zipUnpackedBytes(claimTwoEntries, LIMIT)).toBeNull();
  });

  it('returns null when a part cannot be read: other method, cut off, damaged or no local header', () => {
    const zip = zipSync({ [NAME]: text(1000) });
    const changed = (edit: (copy: Uint8Array, view: DataView, central: number) => void) => {
      const copy = zip.slice();
      edit(copy, viewOf(copy), centralOf(copy));
      return copy;
    };

    const otherMethod = changed((_, view, central) => view.setUint16(central + 10, 12, true));
    const cutOff = changed((_, view, central) => view.setUint32(central + 20, 1_000_000, true));
    const damaged = changed((copy) => copy.fill(0xff, DATA_AT, DATA_AT + 4));
    const noLocalHeader = changed((copy) => copy.fill(0, 0, 4));

    expect(zipUnpackedBytes(otherMethod, LIMIT)).toBeNull();
    expect(zipUnpackedBytes(cutOff, LIMIT)).toBeNull();
    expect(zipUnpackedBytes(damaged, LIMIT)).toBeNull();
    expect(zipUnpackedBytes(noLocalHeader, LIMIT)).toBeNull();
  });

  it('finds the directory when bytes follow the end record', () => {
    const zip = zipSync({ [NAME]: text(10) });
    const tail = new Uint8Array(zip.length + 40);
    tail.set(zip);

    expect(zipUnpackedBytes(tail, LIMIT)).toBe(10);
  });

  it('returns null for bytes that are no ZIP or whose directory is cut off', () => {
    const zip = zipSync({ [NAME]: text(10) });

    expect(
      zipUnpackedBytes(new TextEncoder().encode('not a zip at all, just text'), LIMIT)
    ).toBeNull();
    expect(zipUnpackedBytes(zip.slice(0, zip.length - 30), LIMIT)).toBeNull();
  });
});
