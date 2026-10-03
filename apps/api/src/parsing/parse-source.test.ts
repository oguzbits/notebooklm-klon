import { SOURCE_KIND } from '@nlm/shared';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { AUDIO_MIME } from '../core/audio-type';
import { createParseSource } from './parse-source';

const encode = (text: string) => new TextEncoder().encode(text);
const VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const NO_TEXT = { text: '', pageCount: null };

/** A provider whose parts do nothing unless the test gives them something to do. */
const provider = (parts: Partial<Parameters<typeof createParseSource>[0]>) => ({
  parse: async () => NO_TEXT,
  parseImage: async () => NO_TEXT,
  parseAudio: async () => NO_TEXT,
  parseVideoUrl: async () => NO_TEXT,
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

  it('reads a PPTX source as a presentation and rejects a ZIP that is none', async () => {
    const parse = createParseSource(provider({}));
    const slides = zipSync({
      'ppt/presentation.xml': strToU8(
        '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId r:id="rId1"/></p:sldIdLst></p:presentation>'
      ),
      'ppt/_rels/presentation.xml.rels': strToU8(
        '<Relationships><Relationship Id="rId1" Type="t/slide" Target="slides/slide1.xml"/></Relationships>'
      ),
      'ppt/slides/slide1.xml': strToU8(
        '<p:sld xmlns:p="p" xmlns:a="a"><p:sp><p:txBody><a:p><a:r><a:t>Folientext</a:t></a:r></a:p></p:txBody></p:sp></p:sld>'
      ),
    });

    expect((await parse(SOURCE_KIND.PPTX, slides)).text).toContain('Folientext');
    await expect(
      parse(SOURCE_KIND.PPTX, zipSync({ 'word/document.xml': strToU8('<w/>') }))
    ).rejects.toThrow();
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

  it('hands a recording to the audio reader with the type its first bytes name', async () => {
    let received: { bytes: Uint8Array; mimeType: string } | undefined;
    const parse = createParseSource(
      provider({
        parseAudio: async (bytes, mimeType) => {
          received = { bytes, mimeType };
          return { text: 'Gesprochener Text', pageCount: null };
        },
      })
    );
    const mp3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0]);

    expect(await parse(SOURCE_KIND.AUDIO, mp3)).toEqual({
      text: 'Gesprochener Text',
      pageCount: null,
    });
    expect(received).toEqual({ bytes: mp3, mimeType: AUDIO_MIME.MP3 });
  });

  it('fails when the bytes of an audio source are not audio, instead of guessing a type', async () => {
    const parse = createParseSource(provider({}));

    await expect(parse(SOURCE_KIND.AUDIO, encode('<html>'))).rejects.toThrow(/not audio/);
  });

  it('hands the link of a YouTube source to the video reader', async () => {
    let received: string | undefined;
    const parse = createParseSource(
      provider({
        parseVideoUrl: async (url) => {
          received = url;
          return { text: 'Gesprochener Text', pageCount: null };
        },
      })
    );

    expect(await parse(SOURCE_KIND.YOUTUBE, encode(VIDEO_URL))).toEqual({
      text: 'Gesprochener Text',
      pageCount: null,
    });
    expect(received).toBe(VIDEO_URL);
  });

  it('hands the model the canonical link even when the stored bytes are another form of it', async () => {
    let received: string | undefined;
    const parse = createParseSource(
      provider({
        parseVideoUrl: async (url) => {
          received = url;
          return NO_TEXT;
        },
      })
    );

    await parse(SOURCE_KIND.YOUTUBE, encode('https://youtu.be/jNQXAC9IVRw?t=5'));

    expect(received).toBe(VIDEO_URL);
  });

  it('fails when the bytes of a YouTube source are not a YouTube link, so no other address reaches the model', async () => {
    let calls = 0;
    const parse = createParseSource(
      provider({
        parseVideoUrl: async () => {
          calls += 1;
          return NO_TEXT;
        },
      })
    );

    await expect(parse(SOURCE_KIND.YOUTUBE, encode('https://example.com/video'))).rejects.toThrow(
      /not a YouTube/
    );
    expect(calls).toBe(0);
  });
});
