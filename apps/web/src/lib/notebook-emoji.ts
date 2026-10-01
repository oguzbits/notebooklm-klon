/**
 * The symbols a notebook wears on its card until its overview has chosen one (the original picks one
 * for each notebook). Only the stand-in: a notebook with an overview shows its own.
 */
const EMOJIS = ['📚', '🔬', '💡', '🧠', '🌍', '📝', '🔭', '🧩', '🎓', '⚖️', '📊', '🌱'] as const;

/** The same notebook always gets the same symbol, taken from its ID. */
export function notebookEmoji(notebookId: string): string {
  let hash = 0;
  for (const char of notebookId) hash = (hash * 31 + char.charCodeAt(0)) % EMOJIS.length;
  return EMOJIS[hash] ?? EMOJIS[0];
}
