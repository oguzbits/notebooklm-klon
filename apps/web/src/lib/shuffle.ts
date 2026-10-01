/** The items in a random order (Fisher-Yates). The list that was passed in stays as it is. */
export function shuffle<T>(items: readonly T[]): T[] {
  const mixed = [...items];
  for (let i = mixed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const held = mixed[i];
    const other = mixed[j];
    if (held === undefined || other === undefined) continue;
    mixed[i] = other;
    mixed[j] = held;
  }
  return mixed;
}
