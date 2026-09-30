/** The symbols a notebook can wear on its card; the original picks one for each notebook. */
const EMOJIS = ['📚', '🔬', '💡', '🧠', '🌍', '📝', '🔭', '🧩', '🎓', '⚖️', '📊', '🌱'] as const;

/** The same notebook always gets the same symbol, taken from its ID. */
export function notebookEmoji(notebookId: string): string {
  let hash = 0;
  for (const char of notebookId) hash = (hash * 31 + char.charCodeAt(0)) % EMOJIS.length;
  return EMOJIS[hash] ?? EMOJIS[0];
}
