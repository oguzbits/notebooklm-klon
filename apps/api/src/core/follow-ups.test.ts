import { describe, expect, it } from 'vitest';

import { cleanFollowUps } from './follow-ups';

describe('cleanFollowUps', () => {
  it('keeps the questions in their order', () => {
    expect(cleanFollowUps(['Wer leitet es?', 'Wie teuer ist es?'], 'Frage')).toEqual([
      'Wer leitet es?',
      'Wie teuer ist es?',
    ]);
  });

  it('drops a question the reader just asked, however it is spelled', () => {
    expect(
      cleanFollowUps(
        ['  wer LEITET das Projekt?  ', 'Wie teuer ist es?'],
        'Wer leitet das Projekt?'
      )
    ).toEqual(['Wie teuer ist es?']);
  });

  it('drops a question that is there twice', () => {
    expect(cleanFollowUps(['Wie teuer ist es?', 'wie teuer ist es?'], 'Frage')).toEqual([
      'Wie teuer ist es?',
    ]);
  });

  it('keeps at most three', () => {
    expect(cleanFollowUps(['a?', 'b?', 'c?', 'd?'], 'Frage')).toEqual(['a?', 'b?', 'c?']);
  });
});
