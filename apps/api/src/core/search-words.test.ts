import { describe, expect, it } from 'vitest';

import { searchWords } from './search-words';

describe('searchWords', () => {
  it('returns the lower-cased words of the question in order', () => {
    expect(searchWords('Wie hoch war die Erwerbslosenquote 2018?')).toEqual([
      'wie',
      'hoch',
      'war',
      'die',
      'erwerbslosenquote',
      '2018',
    ]);
  });

  it('keeps umlauts and other letters', () => {
    expect(searchWords('Größe der Würde')).toEqual(['größe', 'der', 'würde']);
  });

  it('splits numbers with separators into digit groups', () => {
    expect(searchWords('46,2 Millionen')).toEqual(['46', '2', 'millionen']);
  });

  it('removes duplicates regardless of case', () => {
    expect(searchWords('Recht recht RECHT')).toEqual(['recht']);
  });

  it('never passes query syntax through', () => {
    expect(searchWords("a' & b:* | !c (d) <-> e\\")).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns an empty list when nothing searchable is left', () => {
    expect(searchWords('')).toEqual([]);
    expect(searchWords(' ?! & | ')).toEqual([]);
  });
});
