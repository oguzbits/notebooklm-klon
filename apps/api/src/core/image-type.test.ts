import { describe, expect, it } from 'vitest';

import { detectImageType } from './image-type';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe('detectImageType', () => {
  it('knows a PNG by its signature', () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      'image/png'
    );
  });

  it('knows a JPEG by its signature', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('image/jpeg');
  });

  it('knows a WebP by RIFF, a size and WEBP', () => {
    expect(
      detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP'), ...ascii('VP8 ')))
    ).toBe('image/webp');
    // A WAV file is a RIFF file too.
    expect(detectImageType(bytes(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')))).toBeNull();
  });

  it('refuses everything else, however it is named', () => {
    expect(
      detectImageType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg"/>')))
    ).toBeNull();
    expect(detectImageType(bytes(...ascii('GIF89a')))).toBeNull();
    expect(detectImageType(bytes(...ascii('<script>alert(1)</script>')))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
    expect(detectImageType(bytes(0x89, 0x50))).toBeNull();
  });
});
