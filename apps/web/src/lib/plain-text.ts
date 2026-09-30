/** The text of an answer without the bold markers, for copying it and for a note that becomes a source. */
export function withoutMarkers(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1');
}
