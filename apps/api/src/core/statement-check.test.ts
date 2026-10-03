import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { findUnsupportedNumbers, repeatsStatement } from './statement-check';

const SEPARATORS = [' ', '.', ',', ' '] as const;

/** Digits in groups of three, the way a table or a text writes a thousands separator. */
function grouped(value: number, separator: string): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/** A figure in thousands as a table gives it: five digits, at least two of them significant. */
const tableFigure = fc.integer({ min: 10_001, max: 99_999 }).filter((value) => value % 1000 !== 0);

const lowercaseWord = fc.stringMatching(/^[a-zäöü]{5,12}$/);
const topicWords = fc.uniqueArray(lowercaseWord, { minLength: 2, maxLength: 6 });
const year = fc.integer({ min: 1500, max: 2099 });

describe('repeatsStatement', () => {
  it('finds the same fact stated twice in different words', () => {
    expect(
      repeatsStatement(
        'Das Projekt Nordlicht hat ein Gesamtbudget von 1,25 Mio. Euro.',
        'Das Gesamtbudget des Projekts Nordlicht beträgt 1,25 Mio. Euro.'
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

  it('counts a statement with topic words as a repeat of itself', () => {
    fc.assert(
      fc.property(topicWords, (words) => {
        const statement = `${words.join(' ')}.`;
        expect(repeatsStatement(statement, statement)).toBe(true);
      })
    );
  });

  it('does not merge a statement with one that is only one of its topic words', () => {
    fc.assert(
      fc.property(topicWords, (words) => {
        expect(repeatsStatement(words.join(' '), words[0] ?? '')).toBe(false);
      })
    );
  });

  it('gives the same answer whichever statement comes first', () => {
    fc.assert(
      fc.property(topicWords, topicWords, (first, second) => {
        const a = first.join(' ');
        const b = second.join(' ');
        expect(repeatsStatement(a, b)).toBe(repeatsStatement(b, a));
      })
    );
  });

  it('does not merge the same words for two different years', () => {
    fc.assert(
      fc.property(topicWords, year, year, (words, first, second) => {
        fc.pre(first !== second);
        const sentence = (when: number) => `${words.join(' ')} im Jahr ${when}`;
        expect(repeatsStatement(sentence(first), sentence(second))).toBe(false);
      })
    );
  });
});

describe('findUnsupportedNumbers', () => {
  it('lists the numbers of a statement that no passage contains', () => {
    const statement = 'Der Umsatz lag bei 455 T€ mit 24 Mitarbeitenden und 12 % Wachstum.';

    expect(findUnsupportedNumbers(statement, 'Umsatz (T€) 455, Mitarbeitende 24')).toEqual(['12']);
  });

  it('does not take a single digit followed by zeros as a figure of the evidence', () => {
    expect(findUnsupportedNumbers('Es waren 50 Personen.', '5 Personen')).toEqual(['50']);
  });

  it('finds nothing unsupported in a text that is its own evidence', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (text) => {
        expect(findUnsupportedNumbers(text, text)).toEqual([]);
      })
    );
  });

  it('only gets more permissive when more evidence is added', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (statement, evidence, more) => {
        const before = findUnsupportedNumbers(statement, evidence);
        const after = findUnsupportedNumbers(statement, `${evidence}\n${more}`);
        expect(after.every((number) => before.includes(number))).toBe(true);
      })
    );
  });

  it('reads a number the same whichever separators group its digits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 999_999_999 }),
        fc.constantFrom(...SEPARATORS),
        fc.constantFrom(...SEPARATORS),
        (value, inEvidence, inStatement) => {
          expect(
            findUnsupportedNumbers(
              `Es sind ${grouped(value, inStatement)} Euro.`,
              `Budget: ${grouped(value, inEvidence)} Euro`
            )
          ).toEqual([]);
        }
      )
    );
  });

  describe('a figure the evidence gives in thousands', () => {
    it('accepts it rounded to millions with one decimal', () => {
      fc.assert(
        fc.property(tableFigure, (figure) => {
          const tenths = Math.floor((figure + 50) / 100);
          fc.pre(tenths % 100 !== 0);
          const millions = `${Math.floor(tenths / 10)},${tenths % 10}`;

          expect(
            findUnsupportedNumbers(`Es waren ${millions} Millionen.`, `Wert ${figure}`)
          ).toEqual([]);
        })
      );
    });

    it('accepts it written out in full', () => {
      fc.assert(
        fc.property(tableFigure, fc.constantFrom(...SEPARATORS), (figure, separator) => {
          const full = grouped(figure * 1000, separator);

          expect(findUnsupportedNumbers(`Es waren ${full}.`, `Wert ${figure}`)).toEqual([]);
        })
      );
    });

    it('rejects it when one digit of the full figure differs', () => {
      fc.assert(
        fc.property(
          tableFigure,
          fc.nat({ max: 4 }),
          fc.integer({ min: 1, max: 9 }),
          (figure, position, shift) => {
            const digits = String(figure).split('');
            const changed = (Number(digits[position]) + shift) % 10;
            fc.pre(position > 0 || changed !== 0);
            digits[position] = String(changed);
            const wrong = `${digits.join('')}000`;

            expect(findUnsupportedNumbers(`Es waren ${wrong}.`, `Wert ${figure}`)).toEqual([wrong]);
          }
        )
      );
    });
  });
});
