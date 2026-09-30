import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseDocx } from './parse-docx';
import { parseText } from './parse-text';
import { pageTitle, parseWebPage } from './parse-web';

const encode = (text: string) => new TextEncoder().encode(text);

describe('parseText', () => {
  it('decodes UTF-8 including umlauts', async () => {
    expect(await parseText(encode('Größe über Äpfel'))).toEqual({
      text: 'Größe über Äpfel',
      pageCount: null,
    });
  });

  it('rejects bytes that are not valid UTF-8 instead of guessing an encoding', async () => {
    await expect(parseText(new Uint8Array([0xff, 0xfe, 0x41, 0x80]))).rejects.toThrow();
  });
});

describe('parseDocx', () => {
  const fixture = new Uint8Array(
    readFileSync(new URL('./fixtures/nordlicht.docx', import.meta.url))
  );

  it('keeps headings and paragraphs', async () => {
    const { text } = await parseDocx(fixture);

    expect(text).toContain('# 1. Zusammenfassung');
    expect(text).toContain('Das Projekt Nordlicht wird von Dr. Katharina Brandt geleitet.');
    expect(text).toContain('Helmholz Systems');
  });

  it('writes a table as a Markdown table, a row on one line', async () => {
    const { text } = await parseDocx(fixture);

    expect(text).toContain('| Quartal | Umsatz (T€) | Mitarbeitende |\n| --- | --- | --- |');
    expect(text).toContain('| Q3 2025 | 455 | 24 |');
  });

  it('drops embedded images instead of putting their data into the text', async () => {
    const { text } = await parseDocx(fixture);

    expect(text).not.toContain('base64');
    expect(text).not.toContain('iVBOR');
  });

  it('rejects bytes that are not a DOCX file', async () => {
    await expect(parseDocx(encode('kein docx'))).rejects.toThrow();
  });
});

describe('parseWebPage', () => {
  const article = `<html><head><title>Ein Artikel</title></head><body>
    <nav><a href="/">Start</a><a href="/x">Kontakt</a></nav>
    <article><h1>Ein Artikel</h1>
    <p>${'Dies ist ein längerer Absatz mit genügend Text für die Erkennung. '.repeat(8)}</p>
    <p>${'Der zweite Absatz erzählt die Geschichte weiter und bleibt lesbar. '.repeat(6)}</p>
    </article><footer>Impressum und Datenschutz</footer></body></html>`;

  it('extracts the article text and puts the title first', async () => {
    const { text } = await parseWebPage(encode(article));

    expect(text.startsWith('# Ein Artikel')).toBe(true);
    expect(text).toContain('Dies ist ein längerer Absatz');
    expect(text).toContain('Der zweite Absatz erzählt');
  });

  it('keeps links with an address that works, bold and italic text', async () => {
    const page = `<html><head><title>Jev</title>
      <link rel="canonical" href="https://example.org/wiki/Jev"></head><body><article>
      <h1>Jev</h1><p>${'Ein langer Absatz, der den Artikel erkennbar macht. '.repeat(8)}
      <b>Jev</b> nutzt <a href="/wiki/Transformer">Transformer</a> und <i>synthetische Daten</i>.</p>
      <p>${'Noch ein Absatz, damit genug Text vorhanden ist und er lesbar bleibt. '.repeat(6)}</p>
      </article></body></html>`;

    const { text } = await parseWebPage(encode(page));

    expect(text).toContain('**Jev** nutzt [Transformer](https://example.org/wiki/Transformer)');
    expect(text).toContain('*synthetische Daten*');
  });

  it('writes the title as a heading without letting its characters act as formatting', async () => {
    const page = `<html><head><title>A * B</title></head><body><article>
      <p>${'Ein langer Absatz, der den Artikel erkennbar macht. '.repeat(10)}</p>
      <p>${'Noch ein Absatz, damit genug Text vorhanden ist und er lesbar bleibt. '.repeat(8)}</p>
      </article></body></html>`;

    const { text } = await parseWebPage(encode(page));

    expect(text.startsWith('# A \\* B\n\n')).toBe(true);
  });

  it('leaves out navigation and footer', async () => {
    const { text } = await parseWebPage(encode(article));

    expect(text).not.toContain('Kontakt');
    expect(text).not.toContain('Impressum');
  });

  it('falls back to the visible text when the page has no article', async () => {
    const { text } = await parseWebPage(encode('<html><body><p>Kurz.</p></body></html>'));

    expect(text).toContain('Kurz.');
  });

  it('returns no page count for web pages', async () => {
    expect((await parseWebPage(encode(article))).pageCount).toBeNull();
  });
});

describe('pageTitle', () => {
  it('returns the trimmed title of a page', () => {
    expect(pageTitle(encode('<html><head><title>  Mein Titel </title></head></html>'))).toBe(
      'Mein Titel'
    );
  });

  it('returns null for a page without a title', () => {
    expect(pageTitle(encode('<html><body><p>Text</p></body></html>'))).toBeNull();
    expect(pageTitle(encode('<html><head><title> </title></head></html>'))).toBeNull();
  });
});
