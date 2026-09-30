import { describe, expect, it } from 'vitest';

import { withoutMarkers } from './plain-text';

describe('withoutMarkers', () => {
  it('takes the bold markers away and keeps the words', () => {
    expect(withoutMarkers('Jev nutzt **typisierte Werte** und **RLCD**.')).toBe(
      'Jev nutzt typisierte Werte und RLCD.'
    );
  });

  it('leaves a single star and text without markers alone', () => {
    expect(withoutMarkers('5 * 3 = 15')).toBe('5 * 3 = 15');
    expect(withoutMarkers('Nichts zu tun.')).toBe('Nichts zu tun.');
  });
});
