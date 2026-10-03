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
});
