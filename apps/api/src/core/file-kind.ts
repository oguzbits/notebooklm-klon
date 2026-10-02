import { SOURCE_KIND, type SourceKind } from '@nlm/shared';

import { detectAudioType } from './audio-type';
import { detectImageType } from './image-type';

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04, a DOCX and a PPTX are ZIPs

const TEXT_KINDS = new Map<string, SourceKind>([
  ['txt', SOURCE_KIND.TXT],
  ['md', SOURCE_KIND.MD],
  ['markdown', SOURCE_KIND.MD],
]);

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((value, index) => bytes[index] === value);

type Check = { kind: SourceKind; matches: (bytes: Uint8Array) => boolean };

const isZip = (bytes: Uint8Array) => startsWith(bytes, ZIP_SIGNATURE);
const isImage = (bytes: Uint8Array) => detectImageType(bytes) !== null;
const isAudio = (bytes: Uint8Array) => detectAudioType(bytes) !== null;

/** Kinds whose content must agree with the extension: the first bytes are checked. */
const CHECKED_KINDS = new Map<string, Check>([
  ['pdf', { kind: SOURCE_KIND.PDF, matches: (bytes) => startsWith(bytes, PDF_SIGNATURE) }],
  ['docx', { kind: SOURCE_KIND.DOCX, matches: isZip }],
  ['pptx', { kind: SOURCE_KIND.PPTX, matches: isZip }],
  ['png', { kind: SOURCE_KIND.IMAGE, matches: isImage }],
  ['jpg', { kind: SOURCE_KIND.IMAGE, matches: isImage }],
  ['jpeg', { kind: SOURCE_KIND.IMAGE, matches: isImage }],
  ['webp', { kind: SOURCE_KIND.IMAGE, matches: isImage }],
  ['mp3', { kind: SOURCE_KIND.AUDIO, matches: isAudio }],
  ['wav', { kind: SOURCE_KIND.AUDIO, matches: isAudio }],
]);

/**
 * The kind of an uploaded file, from its name and its first bytes together, or null when it is not
 * one of the supported kinds. Trusting only the name would let a renamed file through.
 */
export function detectSourceKind(filename: string, bytes: Uint8Array): SourceKind | null {
  if (bytes.length === 0) return null;
  const dot = filename.lastIndexOf('.');
  const extension = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';

  const checked = CHECKED_KINDS.get(extension);
  if (checked) return checked.matches(bytes) ? checked.kind : null;
  return TEXT_KINDS.get(extension) ?? null;
}
