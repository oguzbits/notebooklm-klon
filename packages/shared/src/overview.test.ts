import { describe, expect, it } from 'vitest';

import {
  NotebookOverviewResponseSchema,
  NotebookOverviewSchema,
  SourceOverviewSchema,
} from './overview';

describe('source overview contract', () => {
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

describe('notebook overview contract', () => {
  const summary = 'Die Quellen beschreiben **Jev**, ein Modell für strukturierte Werte.';

  it('takes one symbol, also when it is made of several parts', () => {
    for (const emoji of ['🔬', '❤️', '👩‍🔬', '🏳️‍🌈', '👍🏽']) {
      expect(NotebookOverviewSchema.safeParse({ emoji, summary }).success).toBe(true);
    }
  });

  it('refuses text, digits, several symbols and nothing as the symbol', () => {
    for (const emoji of ['A', '12', 'Jev', '🤖🔬', '🤖 🔬', '', ' ', '🤖x']) {
      expect(NotebookOverviewSchema.safeParse({ emoji, summary }).success).toBe(false);
    }
  });

  it('refuses an empty summary', () => {
    expect(NotebookOverviewSchema.safeParse({ emoji: '🤖', summary: '  ' }).success).toBe(false);
  });

  it('answers with the overview, or with null while no source is ready', () => {
    expect(NotebookOverviewResponseSchema.parse({ overview: { emoji: '🤖', summary } })).toEqual({
      overview: { emoji: '🤖', summary },
    });
    expect(NotebookOverviewResponseSchema.parse({ overview: null })).toEqual({ overview: null });
    expect(NotebookOverviewResponseSchema.safeParse({}).success).toBe(false);
  });
});
