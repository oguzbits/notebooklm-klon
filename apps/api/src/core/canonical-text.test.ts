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

  it('is idempotent', () => {
    const once = toCanonicalText('\r\n a  \r\n\r\n\r\n b\u0000 ');

    expect(toCanonicalText(once)).toBe(once);
  });

  describe('a Markdown table whose delimiter row has another number of cells than its header', () => {
    const header = '| Bevölkerung |1 | Erwerbspersonen |2 |3 | Davon | | | |';
    const row = '| 2018 | 82 902 | 46 185 | 1 468 | 44 717 | 90,6 | 9,4 |';

    it('gives the delimiter row the cells of the header, so the table is one', () => {
      const raw = `${header}\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n${row}`;

      expect(toCanonicalText(raw)).toBe(
        `${header}\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n${row}`
      );
    });

    it('keeps the alignment of the cells it has and cuts a delimiter row that is too long', () => {
      expect(toCanonicalText('| a | b |\n| ---: | :---: | :--- |')).toBe(
        '| a | b |\n| ---: | :---: |'
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
