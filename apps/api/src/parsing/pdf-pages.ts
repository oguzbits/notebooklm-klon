import { PDFDocument } from 'pdf-lib';

/** Number of pages of a PDF, read before any provider call so oversized files cost nothing. */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  return document.getPageCount();
}
