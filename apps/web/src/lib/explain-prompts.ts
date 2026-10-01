/** The question the chat is asked when a flashcard is to be explained. */
export function explainCardPrompt(card: { front: string; back: string }): string {
  return `Erkläre mir diese Karteikarte genauer. Vorderseite: „${card.front}“ Rückseite: „${card.back}“`;
}

/** The question the chat is asked when a question of a quiz is to be explained. */
export function explainQuizPrompt(question: string, rightAnswer: string | undefined): string {
  return `Erkläre mir diese Quizfrage genauer: „${question}“ Richtige Antwort: „${rightAnswer}“`;
}
