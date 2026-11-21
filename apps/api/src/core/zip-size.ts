import { Inflate } from 'fflate';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_BYTES = 22;
/** The end record may be followed by a comment of at most 65 535 bytes. */
const EOCD_MAX_SEARCH = EOCD_MIN_BYTES + 0xffff;
const CENTRAL_HEADER_BYTES = 46;
const LOCAL_HEADER_BYTES = 30;
const STORED = 0;
const DEFLATED = 8;
/** DEFLATE gives at most about 1 000 bytes for one, so a slice this size overshoots the limit by little. */
const SLICE_BYTES = 16 * 1024;

interface Part {
  method: number;
  compressedBytes: number;
  localHeaderOffset: number;
}

/** The parts the central directory lists, or null when the directory is damaged. */
function parts(bytes: Uint8Array, view: DataView): Part[] | null {
  const lowest = Math.max(0, bytes.length - EOCD_MAX_SEARCH);
  let end = bytes.length - EOCD_MIN_BYTES;
  while (end >= lowest && view.getUint32(end, true) !== EOCD_SIGNATURE) end -= 1;
  if (end < lowest) return null;

  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const found: Part[] = [];
  for (let index = 0; index < entries; index += 1) {
    if (offset + CENTRAL_HEADER_BYTES > bytes.length) return null;
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) return null;
    found.push({
      method: view.getUint16(offset + 10, true),
      compressedBytes: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    const names = view.getUint16(offset + 28, true);
    const extras = view.getUint16(offset + 30, true);
    const comments = view.getUint16(offset + 32, true);
    offset += CENTRAL_HEADER_BYTES + names + extras + comments;
  }
  return found;
}

/** What `data` unpacks to, counted slice by slice and given up once it is more than `room`; null when it is not DEFLATE. */
function inflatedBytes(data: Uint8Array, room: number): number | null {
  let total = 0;
  const inflate = new Inflate((chunk) => {
    total += chunk.length;
  });
  try {
    for (let at = 0; at < data.length && total <= room; at += SLICE_BYTES) {
      inflate.push(data.subarray(at, at + SLICE_BYTES), at + SLICE_BYTES >= data.length);
    }
  } catch (error) {
    // fflate throws an Error for a damaged stream; the caller treats it like a damaged directory.
    if (!(error instanceof Error)) throw error;
    return null;
  }
  return total;
}

/**
 * How many bytes a ZIP file (DOCX, PPTX) really unpacks to, counted by inflating every part, or null
 * when it is damaged. It stops as soon as the count passes `limit` and returns that count, so a ZIP
 * bomb costs about `limit` bytes of work, not its full size. The sizes in the directory are not used:
 * a bomb states a small one and unpacks to far more.
 */
export function zipUnpackedBytes(bytes: Uint8Array, limit: number): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const listed = parts(bytes, view);
  if (listed === null) return null;

  let total = 0;
  for (const part of listed) {
    const header = part.localHeaderOffset;
    if (header + LOCAL_HEADER_BYTES > bytes.length) return null;
    if (view.getUint32(header, true) !== LOCAL_SIGNATURE) return null;
    const start =
      header +
      LOCAL_HEADER_BYTES +
      view.getUint16(header + 26, true) +
      view.getUint16(header + 28, true);
    const data = bytes.subarray(start, start + part.compressedBytes);
    if (data.length < part.compressedBytes) return null;

    if (part.method === STORED) total += data.length;
    else if (part.method === DEFLATED) {
      const unpacked = inflatedBytes(data, limit - total);
      if (unpacked === null) return null;
      total += unpacked;
    } else return null;
    if (total > limit) return total;
  }
  return total;
}
