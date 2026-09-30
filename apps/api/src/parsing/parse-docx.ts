import mammoth from 'mammoth';

import type { ParsedDocument } from '../ingestion/ingest';
import { htmlToText } from './html-text';

/**
 * DOCX goes through HTML so tables keep their rows. Raw text would turn every cell into its own
 * paragraph and lose which value belongs to which row.
 */
export async function parseDocx(bytes: Uint8Array): Promise<ParsedDocument> {
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
  return { text: htmlToText(value), pageCount: null };
}
