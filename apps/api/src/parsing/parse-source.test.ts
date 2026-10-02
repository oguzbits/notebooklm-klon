import { SOURCE_KIND } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { createParseSource } from './parse-source';

const encode = (text: string) => new TextEncoder().encode(text);
const NO_TEXT = { text: '', pageCount: null };

/** A provider whose parts do nothing unless the test gives them something to do. */
const provider = (parts: Partial<Parameters<typeof createParseSource>[0]>) => ({
  parse: async () => NO_TEXT,
  parseImage: async () => NO_TEXT,
  ...parts,
});

describe('createParseSource', () => {
  it('reads TXT and MD as text', async () => {
    const parse = createParseSource(
      provider({ parse: async () => ({ text: 'pdf', pageCount: 1 }) })
    );

    expect((await parse(SOURCE_KIND.TXT, encode('Notiz'))).text).toBe('Notiz');
    expect((await parse(SOURCE_KIND.MD, encode('# Titel'))).text).toBe('# Titel');
  });

  it('hands PDF bytes to the PDF parser', async () => {
    let received: Uint8Array | undefined;
    const parse = createParseSource(
      provider({
        parse: async (bytes) => {
          received = bytes;
          return { text: 'aus dem PDF', pageCount: 4 };
        },
      })
    );
    const bytes = encode('%PDF');

    expect(await parse(SOURCE_KIND.PDF, bytes)).toEqual({ text: 'aus dem PDF', pageCount: 4 });
    expect(received).toBe(bytes);
  });

  it('reads a URL source as a web page', async () => {
    const parse = createParseSource(
      provider({ parse: async () => ({ text: '', pageCount: null }) })
    );

    const { text } = await parse(SOURCE_KIND.URL, encode('<html><body><p>Seite</p></body></html>'));

    expect(text).toContain('Seite');
  });

  it('hands an image to the image reader with the type its first bytes name', async () => {
    let received: { bytes: Uint8Array; mimeType: string } | undefined;
    const parse = createParseSource(
      provider({
        parseImage: async (bytes, mimeType) => {
          received = { bytes, mimeType };
          return { text: 'Text im Bild', pageCount: null };
        },
      })
    );
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(await parse(SOURCE_KIND.IMAGE, png)).toEqual({ text: 'Text im Bild', pageCount: null });
    expect(received).toEqual({ bytes: png, mimeType: 'image/png' });
  });

  it('fails when the bytes of an image source are not an image, instead of guessing a type', async () => {
    const parse = createParseSource(provider({}));

    await expect(parse(SOURCE_KIND.IMAGE, encode('<html>'))).rejects.toThrow(/not an image/);
  });

  it('never calls the PDF parser for other kinds', async () => {
    let calls = 0;
    const parse = createParseSource(
      provider({
        parse: async () => {
          calls += 1;
          return { text: '', pageCount: null };
        },
      })
    );

    await parse(SOURCE_KIND.TXT, encode('a'));
    await parse(SOURCE_KIND.URL, encode('<p>a</p>'));

    expect(calls).toBe(0);
  });
});
