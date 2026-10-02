import { PDFDocument } from 'pdf-lib';

/** The bytes are not a PDF the parser can open: the user's file, not a bug of ours. */
export class UnreadablePdfError extends Error {
  constructor(cause: unknown) {
    super('The PDF cannot be read.', { cause });
    this.name = 'UnreadablePdfError';
  }
}

/** Number of pages of a PDF, read before any provider call so oversized files cost nothing. */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    return document.getPageCount();
  } catch (caught) {
    throw new UnreadablePdfError(caught);
  }
}
