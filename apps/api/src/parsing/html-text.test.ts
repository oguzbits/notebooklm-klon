import { describe, expect, it } from 'vitest';

import { htmlToMarkdown } from './html-text';

describe('htmlToMarkdown', () => {
  it('writes headings as Markdown headings and paragraphs as separate blocks', () => {
    const html = '<h1>Titel</h1><p>Erster Absatz.</p><h2>Unterpunkt</h2><p>Zweiter Absatz.</p>';

    expect(htmlToMarkdown(html)).toBe(
      '# Titel\n\nErster Absatz.\n\n## Unterpunkt\n\nZweiter Absatz.'
    );
  });

  it('writes a table as a Markdown table whose first row is the head', () => {
    const html =
      '<table><tr><td><p>Quartal</p></td><td><p>Umsatz</p></td></tr>' +
      '<tr><td><p>Q3 2025</p></td><td><p>455</p></td></tr></table>';

    expect(htmlToMarkdown(html)).toBe('| Quartal | Umsatz |\n| --- | --- |\n| Q3 2025 | 455 |');
  });

  it('fills short rows and keeps a bar inside a cell from splitting it', () => {
    const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>a|b</td></tr></table>';

    expect(htmlToMarkdown(html)).toBe('| A | B |\n| --- | --- |\n| a\\|b |  |');
  });

  it('writes bullet lists, numbered lists and nested lists', () => {
    expect(htmlToMarkdown('<ul><li>eins</li><li>zwei</li></ul>')).toBe('- eins\n- zwei');
    expect(htmlToMarkdown('<ol><li>erst</li><li>dann</li></ol>')).toBe('1. erst\n2. dann');
    expect(htmlToMarkdown('<ul><li>oben<ul><li>unten</li></ul></li></ul>')).toBe(
      '- oben\n  - unten'
    );
    expect(htmlToMarkdown('<ol><li>a<ul><li>b</li></ul></li></ol>')).toBe('1. a\n   - b');
  });

  it('turns a line break into a hard break that survives trimmed line ends', () => {
    expect(htmlToMarkdown('<p>oben<br>unten</p>')).toBe('oben\\\nunten');
  });

  it('collapses whitespace inside a paragraph', () => {
    expect(htmlToMarkdown('<p>viel    \n   Platz</p>')).toBe('viel Platz');
  });

  it('drops scripts, styles, images and other non-text content', () => {
    const html =
      '<style>p{color:red}</style><script>alert(1)</script><p>Sichtbar</p>' +
      '<img src="data:image/png;base64,AAAA"><svg><text>Grafik</text></svg><noscript>JS aus</noscript>';

    expect(htmlToMarkdown(html)).toBe('Sichtbar');
  });

  it('keeps bold, italic and code in the line', () => {
    expect(
      htmlToMarkdown(
        '<p>Ein <strong>fetter</strong>, <em>schiefer</em> und <code>x = 1</code> Text.</p>'
      )
    ).toBe('Ein **fetter**, *schiefer* und `x = 1` Text.');
  });

  it('keeps the spaces outside of the markers and drops empty ones', () => {
    expect(htmlToMarkdown('<p>a<b> fett </b>b<i></i></p>')).toBe('a **fett** b');
  });

  describe('links', () => {
    it('keeps a link with an absolute address', () => {
      expect(htmlToMarkdown('<p>Siehe <a href="https://example.org/a">hier</a>.</p>')).toBe(
        'Siehe [hier](https://example.org/a).'
      );
    });

    it('resolves a relative link against the base of the page', () => {
      const html =
        '<html><head><base href="https://example.org/dir/"></head><body><p><a href="/x">A</a> <a href="y">B</a></p></body></html>';

      expect(htmlToMarkdown(html)).toBe(
        '[A](https://example.org/x) [B](https://example.org/dir/y)'
      );
    });

    it('takes the canonical address of the page as the base when there is no base tag', () => {
      const html =
        '<html><head><link rel="canonical" href="https://example.org/wiki/Jev"></head><body><p><a href="/wiki/Other">Other</a></p></body></html>';

      expect(htmlToMarkdown(html)).toBe('[Other](https://example.org/wiki/Other)');
    });

    it('keeps only the text of a link that cannot be placed or must not be followed', () => {
      const html =
        '<p><a href="/relativ">a</a> <a href="#kap">b</a> <a href="javascript:alert(1)">c</a> <a href="mailto:x@y.z">d</a></p>';

      expect(htmlToMarkdown(html)).toBe('a b c d');
    });

    it('keeps brackets and spaces of an address from ending the link early', () => {
      expect(htmlToMarkdown('<p><a href="https://example.org/Jev_(AI)?q=a b">Jev</a></p>')).toBe(
        '[Jev](https://example.org/Jev_%28AI%29?q=a%20b)'
      );
    });

    it('takes a base given from outside before anything in the page', () => {
      expect(htmlToMarkdown('<p><a href="/x">A</a></p>', 'https://example.org/')).toBe(
        '[A](https://example.org/x)'
      );
    });
  });

  it('writes a heading without links or emphasis', () => {
    expect(htmlToMarkdown('<h2><a href="https://example.org/">Titel</a> <b>[edit]</b></h2>')).toBe(
      '## Titel [edit]'
    );
  });

  it('escapes what Markdown would read as formatting', () => {
    expect(htmlToMarkdown('<p>5 * 3 und _x_ und `y` und &lt;b&gt;</p>')).toBe(
      '5 \\* 3 und \\_x\\_ und \\`y\\` und \\<b>'
    );
    expect(htmlToMarkdown('<p># kein Titel</p>')).toBe('\\# kein Titel');
    expect(htmlToMarkdown('<p>1. keine Liste</p>')).toBe('1\\. keine Liste');
    expect(htmlToMarkdown('<p>- kein Punkt</p>')).toBe('\\- kein Punkt');
  });

  it('keeps preformatted text with its line breaks as a code block', () => {
    expect(htmlToMarkdown('<pre>zeile 1\nzeile 2</pre>')).toBe('```\nzeile 1\nzeile 2\n```');
  });

  it('writes a quotation with a mark in front of each line', () => {
    expect(htmlToMarkdown('<blockquote><p>Zitat.</p><p>Mehr.</p></blockquote>')).toBe(
      '> Zitat.\n>\n> Mehr.'
    );
  });

  it('returns an empty string for a document without text', () => {
    expect(htmlToMarkdown('<div> </div>')).toBe('');
  });
});
