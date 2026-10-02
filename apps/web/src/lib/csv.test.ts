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

  it('puts an apostrophe before a field a spreadsheet would run as a formula', () => {
    expect(toCsv(['a'], [['=SUMME(A1)'], ['+1+1'], ['-2+3'], ['@cmd'], ['\tTab'], ['\rCR']])).toBe(
      "﻿a\r\n'=SUMME(A1)\r\n'+1+1\r\n'-2+3\r\n'@cmd\r\n'\tTab\r\n\"'\rCR\"\r\n"
    );
  });

  it('leaves plain numbers and text with a dash inside alone', () => {
    expect(toCsv(['a'], [['-5'], ['+3,5'], ['Aus-Wahl'], ['5 = 5']])).toBe(
      '﻿a\r\n-5\r\n"+3,5"\r\nAus-Wahl\r\n5 = 5\r\n'
    );
  });
});
