import { describe, expect, it } from 'vitest';

import { htmlToText } from './html-text';

describe('htmlToText', () => {
  it('writes headings as Markdown headings and paragraphs as separate blocks', () => {
    const html = '<h1>Titel</h1><p>Erster Absatz.</p><h2>Unterpunkt</h2><p>Zweiter Absatz.</p>';

    expect(htmlToText(html)).toBe('# Titel\n\nErster Absatz.\n\n## Unterpunkt\n\nZweiter Absatz.');
  });

  it('keeps a table together, one row per line with cells separated by a bar', () => {
    const html =
      '<table><tr><td><p>Quartal</p></td><td><p>Umsatz</p></td></tr>' +
      '<tr><td><p>Q3 2025</p></td><td><p>455</p></td></tr></table>';

    expect(htmlToText(html)).toBe('Quartal | Umsatz\nQ3 2025 | 455');
  });

  it('writes list items as bullet lines', () => {
    expect(htmlToText('<ul><li>eins</li><li>zwei</li></ul>')).toBe('- eins\n- zwei');
  });

  it('turns line breaks into new lines', () => {
    expect(htmlToText('<p>oben<br>unten</p>')).toBe('oben\nunten');
  });

  it('collapses whitespace inside a paragraph', () => {
    expect(htmlToText('<p>viel    \n   Platz</p>')).toBe('viel Platz');
  });

  it('drops scripts, styles, images and other non-text content', () => {
    const html =
      '<style>p{color:red}</style><script>alert(1)</script><p>Sichtbar</p>' +
      '<img src="data:image/png;base64,AAAA"><svg><text>Grafik</text></svg><noscript>JS aus</noscript>';

    expect(htmlToText(html)).toBe('Sichtbar');
  });

  it('keeps inline text together in one line', () => {
    expect(
      htmlToText('<p>Ein <strong>fetter</strong> und <a href="/x">verlinkter</a> Text.</p>')
    ).toBe('Ein fetter und verlinkter Text.');
  });

  it('keeps preformatted text with its line breaks', () => {
    expect(htmlToText('<pre>zeile 1\nzeile 2</pre>')).toBe('zeile 1\nzeile 2');
  });

  it('returns an empty string for a document without text', () => {
    expect(htmlToText('<div> </div>')).toBe('');
  });
});
