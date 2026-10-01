import { describe, expect, it } from 'vitest';

import { toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header and one line per row, with a mark that tells Excel it is UTF-8', () => {
    expect(
      toCsv(
        ['Vorderseite', 'Rückseite'],
        [
          ['Wer?', 'Dr. Brandt'],
          ['Wann?', '2024'],
        ]
      )
    ).toBe('﻿Vorderseite,Rückseite\r\nWer?,Dr. Brandt\r\nWann?,2024\r\n');
  });

  it('quotes a field with a comma, a quote or a line break, and doubles the quotes in it', () => {
    expect(toCsv(['a'], [['eins, zwei'], ['sie sagte "ja"'], ['zwei\nZeilen']])).toBe(
      '﻿a\r\n"eins, zwei"\r\n"sie sagte ""ja"""\r\n"zwei\nZeilen"\r\n'
    );
  });
});
