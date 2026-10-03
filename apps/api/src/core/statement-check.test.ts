import { describe, expect, it } from 'vitest';

import { findUnsupportedNumbers, repeatsStatement } from './statement-check';

describe('repeatsStatement', () => {
  it('finds the same fact stated twice in different words and units', () => {
    expect(
      repeatsStatement(
        'Im Jahr 2018 gab es in Deutschland 46,2 Millionen Erwerbspersonen.',
        'Die Zahl der Erwerbspersonen in Deutschland belief sich 2018 auf 46 185 Tausend.'
      )
    ).toBe(true);
  });

  it('does not merge statements about different facts of one document', () => {
    expect(
      repeatsStatement(
        'Dr. Katharina Brandt leitet das Projekt Nordlicht.',
        'Das Gesamtbudget des Projekts beträgt 1,25 Mio. Euro.'
      )
    ).toBe(false);
  });

  it('does not merge the same measure for two different years', () => {
    expect(
      repeatsStatement(
        'Die Erwerbsquote in Deutschland lag 2018 bei 60 Prozent.',
        'Die Erwerbsquote in Deutschland lag 2019 bei 61 Prozent.'
      )
    ).toBe(false);
  });
});

describe('findUnsupportedNumbers', () => {
  it('lists the numbers of a statement that no passage contains', () => {
    const statement = 'Der Umsatz lag bei 455 T€ mit 24 Mitarbeitenden und 12 % Wachstum.';

    expect(findUnsupportedNumbers(statement, 'Umsatz (T€) 455, Mitarbeitende 24')).toEqual(['12']);
  });

  it('matches a number whatever its separators are', () => {
    expect(findUnsupportedNumbers('Es sind 1.250.000 Euro.', 'Budget: 1,250,000 Euro')).toEqual([]);
  });

  describe('a figure from a table, in thousands with a space as the thousands separator', () => {
    const table = '2018\n82 902\n46 185\n1 468\n44 717';

    it('reads 46 185 as one number', () => {
      expect(findUnsupportedNumbers('Es waren 46.185 Tausend Erwerbspersonen.', table)).toEqual([]);
    });

    it('accepts the same figure rounded and in millions', () => {
      expect(findUnsupportedNumbers('Es waren 46,2 Millionen Erwerbspersonen.', table)).toEqual([]);
    });

    it('still rejects a figure that is neither the number nor a rounding of it', () => {
      expect(findUnsupportedNumbers('Es waren 46,9 Millionen Erwerbspersonen.', table)).toEqual([
        '469',
      ]);
    });

    it('does not take one digit as a rounding of a longer number', () => {
      expect(findUnsupportedNumbers('Es waren 5 Erwerbspersonen.', table)).toEqual(['5']);
    });
  });
});
