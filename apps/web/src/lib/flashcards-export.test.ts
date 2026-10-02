import { afterEach, describe, expect, it, vi } from 'vitest';

import { download } from './download';
import { downloadFlashcards } from './flashcards-export';

vi.mock('./download', () => ({ download: vi.fn() }));

afterEach(() => vi.clearAllMocks());

/** The file as written, byte order mark included: `Blob.text()` would strip it. */
async function written(blob: Blob | undefined): Promise<string | undefined> {
  if (!blob) return undefined;
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer());
}

describe('downloadFlashcards', () => {
  it('hands over one CSV file named after the output, with front and back per card', async () => {
    downloadFlashcards('Kapitel 1', [
      { front: 'Was ist "X"?', back: 'Ein, zwei', chunkIds: ['a'] },
      { front: 'Zeile', back: 'Zwei\nZeilen', chunkIds: ['b'] },
    ]);

    expect(download).toHaveBeenCalledOnce();
    const [name, blob] = vi.mocked(download).mock.calls[0] ?? [];
    expect(name).toBe('Kapitel 1.csv');
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    expect(await written(blob)).toBe(
      '﻿Vorderseite,Rückseite\r\n"Was ist ""X""?","Ein, zwei"\r\nZeile,"Zwei\nZeilen"\r\n'
    );
  });

  it('writes only the header for a set without cards', async () => {
    downloadFlashcards('Leer', []);

    expect(await written(vi.mocked(download).mock.calls[0]?.[1])).toBe(
      '﻿Vorderseite,Rückseite\r\n'
    );
  });
});
