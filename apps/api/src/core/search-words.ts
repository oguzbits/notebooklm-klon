const WORD = /[\p{L}\p{N}]+/gu;

/**
 * The searchable words of a free-text question: lower case, unique, letters and digits only. Since
 * nothing else survives, the words can be joined into a full-text query without user input ever
 * acting as query syntax. Filtering filler words is the database's job, it knows the stop words.
 */
export function searchWords(question: string): string[] {
  return [...new Set(question.toLowerCase().match(WORD) ?? [])];
}
