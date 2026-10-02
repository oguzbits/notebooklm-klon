import { SOURCE_KIND, type SourceKind } from '@nlm/shared';

import { detectImageType } from './image-type';

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04, a DOCX is a ZIP

const TEXT_KINDS = new Map<string, SourceKind>([
  ['txt', SOURCE_KIND.TXT],
  ['md', SOURCE_KIND.MD],
  ['markdown', SOURCE_KIND.MD],
]);

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

const startsWith = (bytes: Uint8Array, signature: number[]) =>
  signature.every((value, index) => bytes[index] === value);

/**
 * The kind of an uploaded file, from its name and its first bytes together, or null when it is not
 * one of the supported kinds. Trusting only the name would let a renamed file through.
 */
export function detectSourceKind(filename: string, bytes: Uint8Array): SourceKind | null {
  if (bytes.length === 0) return null;
  const dot = filename.lastIndexOf('.');
  const extension = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';

  if (extension === 'pdf') return startsWith(bytes, PDF_SIGNATURE) ? SOURCE_KIND.PDF : null;
  if (extension === 'docx') return startsWith(bytes, ZIP_SIGNATURE) ? SOURCE_KIND.DOCX : null;
  if (IMAGE_EXTENSIONS.has(extension)) {
    return detectImageType(bytes) === null ? null : SOURCE_KIND.IMAGE;
  }
  return TEXT_KINDS.get(extension) ?? null;
}
