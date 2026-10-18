import { tr } from './i18n';
/** The question the chat is asked when a flashcard is to be explained. */
export function explainCardPrompt(card: { front: string; back: string }): string {
  return tr(
    `Erkläre mir diese Karteikarte genauer. Vorderseite: „${card.front}“ Rückseite: „${card.back}“`,
    `Explain this flashcard in more detail. Front: “${card.front}” Back: “${card.back}”`
  );
}

/** The question the chat is asked when a question of a quiz is to be explained. */
export function explainQuizPrompt(question: string, rightAnswer: string | undefined): string {
  return tr(
    `Erkläre mir diese Quizfrage genauer: „${question}“ Richtige Antwort: „${rightAnswer}“`,
    `Explain this quiz question in more detail: “${question}” Correct answer: “${rightAnswer}”`
  );
}
