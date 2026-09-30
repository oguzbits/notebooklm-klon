import { SOURCE_KIND } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { toLocalFile } from './corpus';

const bytes = (text: string) => new TextEncoder().encode(text);

describe('toLocalFile', () => {
  it('detects text and PDF files by name and content', () => {
    expect(toLocalFile('bdsg.txt', bytes('Text')).kind).toBe(SOURCE_KIND.TXT);
    expect(toLocalFile('paper.pdf', bytes('%PDF-1.7 ...')).kind).toBe(SOURCE_KIND.PDF);
  });

  it('reads a saved web page as a URL source with an address', () => {
    const file = toLocalFile('07-wikipedia-rag-en.html', bytes('<html></html>'));

    expect(file).toMatchObject({ kind: SOURCE_KIND.URL, name: '07-wikipedia-rag-en.html' });
    expect(file.sourceUrl).toMatch(/^https:\/\//);
  });

  it('throws for a file that is none of the supported kinds', () => {
    expect(() => toLocalFile('bild.png', bytes('x'))).toThrow(/bild\.png/);
    expect(() => toLocalFile('leer.pdf', bytes('kein pdf'))).toThrow(/leer\.pdf/);
  });
});
