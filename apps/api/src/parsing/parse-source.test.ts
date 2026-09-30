import { SOURCE_KIND } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { createParseSource } from './parse-source';

const encode = (text: string) => new TextEncoder().encode(text);

describe('createParseSource', () => {
  it('reads TXT and MD as text', async () => {
    const parse = createParseSource({ parse: async () => ({ text: 'pdf', pageCount: 1 }) });

    expect((await parse(SOURCE_KIND.TXT, encode('Notiz'))).text).toBe('Notiz');
    expect((await parse(SOURCE_KIND.MD, encode('# Titel'))).text).toBe('# Titel');
  });

  it('hands PDF bytes to the PDF parser', async () => {
    let received: Uint8Array | undefined;
    const parse = createParseSource({
      parse: async (bytes) => {
        received = bytes;
        return { text: 'aus dem PDF', pageCount: 4 };
      },
    });
    const bytes = encode('%PDF');

    expect(await parse(SOURCE_KIND.PDF, bytes)).toEqual({ text: 'aus dem PDF', pageCount: 4 });
    expect(received).toBe(bytes);
  });

  it('reads a URL source as a web page', async () => {
    const parse = createParseSource({ parse: async () => ({ text: '', pageCount: null }) });

    const { text } = await parse(SOURCE_KIND.URL, encode('<html><body><p>Seite</p></body></html>'));

    expect(text).toContain('Seite');
  });

  it('never calls the PDF parser for other kinds', async () => {
    let calls = 0;
    const parse = createParseSource({
      parse: async () => {
        calls += 1;
        return { text: '', pageCount: null };
      },
    });

    await parse(SOURCE_KIND.TXT, encode('a'));
    await parse(SOURCE_KIND.URL, encode('<p>a</p>'));

    expect(calls).toBe(0);
  });
});
