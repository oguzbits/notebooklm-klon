import { describe, expect, it } from 'vitest';

import { SourceOverviewSchema } from './overview';

describe('source overview contract', () => {
  it('parses a summary with key topics and suggested questions', () => {
    const overview = {
      summary: 'Das Projekt Nordlicht erforscht Polarlicht.',
      keyTopics: ['Polarlicht', 'Budget'],
      suggestedQuestions: ['Wer leitet das Projekt?', 'Wie hoch ist das Budget?'],
    };

    expect(SourceOverviewSchema.parse(overview)).toEqual(overview);
  });

  it('rejects an empty summary and empty topics or questions', () => {
    const valid = { summary: 'Text.', keyTopics: ['A'], suggestedQuestions: ['Frage?'] };

    expect(SourceOverviewSchema.safeParse({ ...valid, summary: '  ' }).success).toBe(false);
    expect(SourceOverviewSchema.safeParse({ ...valid, keyTopics: [''] }).success).toBe(false);
    expect(SourceOverviewSchema.safeParse({ ...valid, suggestedQuestions: [' '] }).success).toBe(
      false
    );
  });

  it('accepts a source without topics or questions', () => {
    const overview = { summary: 'Sehr kurz.', keyTopics: [], suggestedQuestions: [] };

    expect(SourceOverviewSchema.parse(overview)).toEqual(overview);
  });
});
