import { describe, expect, it } from 'vitest';

import { foundLine, leftOutLines } from './answer-trace';

const trace = { sourcesSearched: 2, passagesFound: 5, droppedStatements: 0, strippedCitations: 0 };

describe('foundLine', () => {
  it('says what the search found, in the singular and the plural', () => {
    expect(foundLine(0)).toBe('keine passende Textstelle gefunden');
    expect(foundLine(1)).toBe('1 Textstelle gefunden');
    expect(foundLine(5)).toBe('5 Textstellen gefunden');
  });
});

describe('leftOutLines', () => {
  it('has no line when nothing was left out', () => {
    expect(leftOutLines(trace)).toEqual([]);
  });

  it('names the statements without proof and the citations that were removed', () => {
    expect(leftOutLines({ ...trace, droppedStatements: 1, strippedCitations: 3 })).toEqual([
      '1 Aussage ohne Beleg wurde weggelassen',
      '3 ungültige Quellenangaben wurden entfernt',
    ]);
  });
});
