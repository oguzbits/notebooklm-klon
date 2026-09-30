import type { ParsedDocument } from '../ingestion/ingest';

/** TXT and Markdown are read as they are. Anything that is not valid UTF-8 is rejected. */
export async function parseText(bytes: Uint8Array): Promise<ParsedDocument> {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { text, pageCount: null };
}
