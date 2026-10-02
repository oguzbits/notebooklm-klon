import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { countPdfPages, UnreadablePdfError } from './pdf-pages';

async function pdfWithPages(count: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let page = 0; page < count; page += 1) doc.addPage();
  return doc.save();
}

describe('countPdfPages', () => {
  it('counts the pages of a PDF', async () => {
    expect(await countPdfPages(await pdfWithPages(1))).toBe(1);
    expect(await countPdfPages(await pdfWithPages(7))).toBe(7);
  });

  it('rejects bytes that are not a PDF', async () => {
    await expect(countPdfPages(new TextEncoder().encode('kein pdf'))).rejects.toThrow(
      UnreadablePdfError
    );
  });

  it('rejects an empty file', async () => {
    await expect(countPdfPages(new Uint8Array())).rejects.toThrow(UnreadablePdfError);
  });
});
