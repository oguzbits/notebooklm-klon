import { describe, expect, it } from 'vitest';

import {
  countRepeatedStatements,
  findForbiddenFacts,
  findUnsupportedNumbers,
  scoreCitations,
  scoreRequiredFacts,
  scoreRetrieval,
} from './scorers';

const chunks = [
  { id: 'c1', text: 'Intro to the market.' },
  { id: 'c2', text: 'In 2025 the   Revenue grew by 12 %.' },
  { id: 'c3', text: 'Costs fell.' },
];

describe('scoreRetrieval', () => {
  it('hits and reports the 1-based rank, ignoring case and whitespace', () => {
    const score = scoreRetrieval(chunks, ['revenue grew by 12 %'], 5);

    expect(score).toEqual({ hit: true, rank: 2, anchorRecall: 1 });
  });

  it('misses when the anchor is only beyond k', () => {
    const score = scoreRetrieval(chunks, ['costs fell'], 2);

    expect(score).toEqual({ hit: false, rank: null, anchorRecall: 0 });
  });

  it('reports partial anchor recall', () => {
    const score = scoreRetrieval(chunks, ['revenue grew', 'not in any chunk'], 3);

    expect(score.hit).toBe(true);
    expect(score.anchorRecall).toBe(0.5);
  });

  it('is not applicable without anchors', () => {
    expect(scoreRetrieval(chunks, [], 5)).toEqual({ hit: false, rank: null, anchorRecall: null });
  });
});

describe('scoreCitations', () => {
  const context = ['c1', 'c2', 'c3'];

  it('scores a fully valid answer', () => {
    const score = scoreCitations(
      [
        { text: 'A', chunkIds: ['c1'] },
        { text: 'B', chunkIds: ['c2', 'c3'] },
      ],
      context
    );

    expect(score).toEqual({
      statements: 2,
      citations: 3,
      invalidCitations: 0,
      validity: 1,
      coverage: 1,
    });
  });

  it('counts citations outside the context as invalid', () => {
    const score = scoreCitations(
      [
        { text: 'A', chunkIds: ['c1', 'c99'] },
        { text: 'B', chunkIds: ['c98'] },
      ],
      context
    );

    expect(score.invalidCitations).toBe(2);
    expect(score.validity).toBeCloseTo(1 / 3);
    expect(score.coverage).toBe(0.5);
  });

  it('counts an uncited statement against coverage only', () => {
    const score = scoreCitations(
      [
        { text: 'A', chunkIds: ['c1'] },
        { text: 'B', chunkIds: [] },
      ],
      context
    );

    expect(score.validity).toBe(1);
    expect(score.coverage).toBe(0.5);
  });

  it('is not applicable for an answer without statements', () => {
    expect(scoreCitations([], context)).toEqual({
      statements: 0,
      citations: 0,
      invalidCitations: 0,
      validity: null,
      coverage: null,
    });
  });
});

describe('scoreRequiredFacts', () => {
  it('returns the share of facts present in the answer', () => {
    const answer = 'Der Umsatz wuchs um 12 % auf 4,2 Mio. Euro.';

    expect(scoreRequiredFacts(answer, ['12 %', '4,2 Mio. Euro', 'Berlin'])).toBeCloseTo(2 / 3);
  });

  it('counts a fact as present when any of its equivalent spellings is', () => {
    const answer = 'Es gab 46,185 Millionen Erwerbspersonen.';

    expect(scoreRequiredFacts(answer, [['46,2', '46,185']])).toBe(1);
    expect(scoreRequiredFacts(answer, [['46,2', '46,3']])).toBe(0);
  });

  it('is not applicable without required facts', () => {
    expect(scoreRequiredFacts('anything', [])).toBeNull();
  });
});

describe('countRepeatedStatements', () => {
  it('finds the same fact stated twice in different words', () => {
    const statements = [
      {
        text: 'Im Jahr 2018 gab es in Deutschland 46,2 Millionen Erwerbspersonen.',
        chunkIds: ['a'],
      },
      {
        text: 'Die Zahl der Erwerbspersonen in Deutschland belief sich 2018 auf 46 185 Tausend.',
        chunkIds: ['b'],
      },
    ];

    expect(countRepeatedStatements(statements)).toBe(1);
  });

  it('does not flag statements about different facts of one document', () => {
    const statements = [
      { text: 'Dr. Katharina Brandt leitet das Projekt Nordlicht.', chunkIds: ['a'] },
      { text: 'Das Gesamtbudget des Projekts beträgt 1,25 Mio. Euro.', chunkIds: ['b'] },
    ];

    expect(countRepeatedStatements(statements)).toBe(0);
  });
});

describe('findUnsupportedNumbers', () => {
  it('lists the numbers of the answer that no cited passage contains', () => {
    const answer = 'Der Umsatz lag bei 455 T€ mit 24 Mitarbeitenden und 12 % Wachstum.';
    const cited = 'Umsatz (T€) 455, Mitarbeitende 24';

    expect(findUnsupportedNumbers(answer, cited)).toEqual(['12']);
  });

  it('matches a number whatever its separators are', () => {
    expect(findUnsupportedNumbers('Es sind 1.250.000 Euro.', 'Budget: 1,250,000 Euro')).toEqual([]);
  });
});

describe('findForbiddenFacts', () => {
  it('returns the forbidden strings the answer contains, ignoring case', () => {
    expect(findForbiddenFacts('Die Quote war 5,9 PROZENT.', ['5,9 Prozent', '7,1'])).toEqual([
      '5,9 Prozent',
    ]);
  });
});
