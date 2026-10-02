export const AUDIO_MIME = {
  MP3: 'audio/mpeg',
  WAV: 'audio/wav',
} as const;

export type AudioMime = (typeof AUDIO_MIME)[keyof typeof AUDIO_MIME];

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

const ID3 = [0x49, 0x44, 0x33];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WAVE = [0x57, 0x41, 0x56, 0x45];
const WAVE_AT = 8;

const FRAME_SYNC = 0xff;
/** The second byte of a frame: eleven bits of sync in all, and the two bits of the layer say layer 3. */
const SYNC_MASK = 0xe0;
const LAYER_MASK = 0x06;
const LAYER_3 = 0x02;

const isFrame = (bytes: Uint8Array) => {
  const second = bytes[1] ?? 0;
  return (
    bytes[0] === FRAME_SYNC &&
    (second & SYNC_MASK) === SYNC_MASK &&
    (second & LAYER_MASK) === LAYER_3
  );
};

/**
 * The kind of audio the first bytes say it is, or null for anything that is not an MP3 or a WAV. The
 * name and the type the browser claims are not trusted, as with images.
 */
export function detectAudioType(bytes: Uint8Array): AudioMime | null {
  if (startsWith(bytes, ID3) || isFrame(bytes)) return AUDIO_MIME.MP3;
  if (startsWith(bytes, RIFF) && startsWith(bytes, WAVE, WAVE_AT)) return AUDIO_MIME.WAV;
  return null;
}
