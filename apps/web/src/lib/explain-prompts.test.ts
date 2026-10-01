import { describe, expect, it } from 'vitest';

import { explainCardPrompt, explainQuizPrompt } from './explain-prompts';

describe('explain prompts', () => {
  it('quotes both sides of a card', () => {
    expect(explainCardPrompt({ front: 'Frage', back: 'Antwort' })).toBe(
      'Erkläre mir diese Karteikarte genauer. Vorderseite: „Frage“ Rückseite: „Antwort“'
    );
  });

  it('quotes the question and its right answer', () => {
    expect(explainQuizPrompt('Wer?', 'Brandt')).toBe(
      'Erkläre mir diese Quizfrage genauer: „Wer?“ Richtige Antwort: „Brandt“'
    );
  });
});
