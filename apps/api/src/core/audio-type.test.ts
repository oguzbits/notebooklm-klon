import { describe, expect, it } from 'vitest';

import { AUDIO_MIME, detectAudioType } from './audio-type';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

describe('detectAudioType', () => {
  it('knows an MP3 with an ID3 tag by the tag', () => {
    expect(detectAudioType(bytes(...ascii('ID3'), 4, 0, 0))).toBe(AUDIO_MIME.MP3);
  });

  it('knows an MP3 without a tag by the sync of its first frame', () => {
    expect(detectAudioType(bytes(0xff, 0xfb, 0x90, 0x00))).toBe(AUDIO_MIME.MP3);
  });

  it('does not take a sync that names no layer 3 frame for an MP3', () => {
    expect(detectAudioType(bytes(0xff, 0xf9, 0x90, 0x00))).toBeNull();
  });

  it('knows a WAV by RIFF, a size and WAVE', () => {
    expect(
      detectAudioType(bytes(...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WAVE'), ...ascii('fmt ')))
    ).toBe(AUDIO_MIME.WAV);
  });

  it('does not take a RIFF that holds something else for a WAV', () => {
    expect(
      detectAudioType(bytes(...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8 ')))
    ).toBeNull();
  });

  it('knows nothing in a text, an empty file or a file that is too short', () => {
    expect(detectAudioType(bytes(...ascii('Hallo Welt')))).toBeNull();
    expect(detectAudioType(bytes())).toBeNull();
    expect(detectAudioType(bytes(0xff))).toBeNull();
    expect(detectAudioType(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAV')))).toBeNull();
  });
});
