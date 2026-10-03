import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { toCanonicalText } from './canonical-text';

describe('toCanonicalText', () => {
  it('unifies line endings to \\n', () => {
    expect(toCanonicalText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('removes control characters and the byte order mark but keeps tabs and newlines', () => {
    expect(toCanonicalText('﻿a\u0000b\u0007c\td\ne')).toBe('abc\td\ne');
  });

  it('strips trailing spaces on every line', () => {
    expect(toCanonicalText('eins   \nzwei\t \ndrei')).toBe('eins\nzwei\ndrei');
  });

  it('collapses three or more line breaks to one blank line', () => {
    expect(toCanonicalText('a\n\n\n\nb\n\nc')).toBe('a\n\nb\n\nc');
  });

  it('trims the whole text', () => {
    expect(toCanonicalText('\n\n  Text \n\n')).toBe('Text');
  });

  it('normalizes to Unicode NFC so composed and decomposed umlauts are the same text', () => {
    expect(toCanonicalText('München')).toBe('München');
  });

  describe('for any text', () => {
    const MARKUP_CHARACTERS = [
      'a',
      'B',
      '7',
      '|',
      ':',
      '-',
      ' ',
      '\t',
      '\r',
      '\n',
      '\0',
      '\u0301',
      '\ufeff',
    ];
    const markup = fc
      .array(fc.constantFrom(...MARKUP_CHARACTERS), { maxLength: 400 })
      .map((chars) => chars.join(''));
    const anyText = fc.oneof(markup, fc.string({ unit: 'binary' }));

    it('is idempotent, also for text that looks like tables', () => {
      fc.assert(
        fc.property(anyText, (raw) => {
          const once = toCanonicalText(raw);

          expect(toCanonicalText(once)).toBe(once);
        })
      );
    });

    it('leaves no carriage return, control character, trailing space or run of blank lines', () => {
      fc.assert(
        fc.property(anyText, (raw) => {
          const text = toCanonicalText(raw);

          for (const unwanted of ['\r', '\0', '\ufeff', ' \n', '\t\n', '\n\n\n']) {
            expect(text).not.toContain(unwanted);
          }
          expect(text).toBe(text.trim());
          expect(text).toBe(text.normalize('NFC'));
        })
      );
    });
  });

  describe('a Markdown table whose delimiter row has another number of cells than its header', () => {
    const cell = fc.stringMatching(/^[A-Za-z0-9 ]{0,12}$/);
    const alignment = fc.constantFrom(':---', '---:', ':---:', '---');
    const row = (cells: string[]) => `| ${cells.join(' | ')} |`;

    it('gives the delimiter row the cells of the header, keeping the alignment it has', () => {
      fc.assert(
        fc.property(
          fc.array(cell, { minLength: 1, maxLength: 10 }),
          fc.array(alignment, { minLength: 1, maxLength: 10 }),
          fc.array(cell, { minLength: 1, maxLength: 10 }),
          (header, alignments, body) => {
            const text = toCanonicalText(`${row(header)}\n${row(alignments)}\n${row(body)}`);
            const [, delimiter] = text.split('\n');
            const cells = (delimiter ?? '').replace(/^\| | \|$/g, '').split(' | ');

            expect(cells).toHaveLength(header.length);
            expect(cells.slice(0, alignments.length)).toEqual(alignments.slice(0, header.length));
          }
        )
      );
    });

    it('leaves a table that is right alone', () => {
      const table = '| a | b |\n| :--- | :--- |\n| 1 | 2 |';

      expect(toCanonicalText(table)).toBe(table);
    });

    it('leaves a line of dashes under ordinary text alone', () => {
      expect(toCanonicalText('Titel\n-----')).toBe('Titel\n-----');
    });
  });
});
