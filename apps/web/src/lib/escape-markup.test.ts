import { describe, expect, it } from 'vitest';

import { escapeMarkup } from './escape-markup';

describe('escapeMarkup', () => {
  it('turns the characters of markup into text, ampersand first', () => {
    expect(escapeMarkup('A & B <b>"c"</b> \'d\'')).toBe(
      'A &amp; B &lt;b&gt;&quot;c&quot;&lt;/b&gt; &#39;d&#39;'
    );
  });

  it('does not escape twice and leaves plain text alone', () => {
    expect(escapeMarkup('&lt;')).toBe('&amp;lt;');
    expect(escapeMarkup('Schlüssel ä ö ü')).toBe('Schlüssel ä ö ü');
  });
});
