import { COVER_IMAGE } from '@nlm/shared';

type CoverType = (typeof COVER_IMAGE.TYPES)[number];

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const WEBP_AT = 8;

/**
 * The kind of image the first bytes say it is, or null for anything that is not a PNG, JPEG or
 * WebP. The name and the type the browser claims are not trusted: a page, a script or an SVG with
 * code in it must never be stored and handed out as an image.
 */
export function detectImageType(bytes: Uint8Array): CoverType | null {
  if (startsWith(bytes, PNG)) return 'image/png';
  if (startsWith(bytes, JPEG)) return 'image/jpeg';
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, WEBP_AT)) return 'image/webp';
  return null;
}
