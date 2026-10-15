const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_MIN_BYTES = 22;
/** The end record may be followed by a comment of at most 65 535 bytes. */
const EOCD_MAX_SEARCH = EOCD_MIN_BYTES + 0xffff;
const CENTRAL_HEADER_BYTES = 46;

/**
 * The sum of the uncompressed sizes a ZIP file (DOCX, PPTX) declares in its central directory, read
 * without unpacking anything, or null when the directory is damaged. A ZIP bomb states its true
 * size here (a parser that unpacks checks it against the real data), so the sum is what to limit.
 */
export function zipUncompressedBytes(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lowest = Math.max(0, bytes.length - EOCD_MAX_SEARCH);
  let end = bytes.length - EOCD_MIN_BYTES;
  while (end >= lowest && view.getUint32(end, true) !== EOCD_SIGNATURE) end -= 1;
  if (end < lowest) return null;

  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  let total = 0;
  for (let index = 0; index < entries; index += 1) {
    if (offset + CENTRAL_HEADER_BYTES > bytes.length) return null;
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) return null;
    total += view.getUint32(offset + 24, true);
    const names = view.getUint16(offset + 28, true);
    const extras = view.getUint16(offset + 30, true);
    const comments = view.getUint16(offset + 32, true);
    offset += CENTRAL_HEADER_BYTES + names + extras + comments;
  }
  return total;
}
