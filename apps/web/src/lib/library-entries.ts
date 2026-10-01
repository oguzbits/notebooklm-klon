import type { Note, StudioOutput } from '@nlm/shared';

export const ENTRY = { OUTPUT: 'OUTPUT', NOTE: 'NOTE' } as const;
export type EntryType = (typeof ENTRY)[keyof typeof ENTRY];

/** Which line of the list is open in the Studio. */
export interface OpenEntry {
  type: EntryType;
  id: string;
}

/** A line of the list: something the Studio made, or a saved answer. */
export type LibraryEntry =
  { type: typeof ENTRY.OUTPUT; output: StudioOutput } | { type: typeof ENTRY.NOTE; note: Note };

const entryTime = (entry: LibraryEntry) =>
  entry.type === ENTRY.OUTPUT ? entry.output.createdAt : entry.note.createdAt;

/** Outputs and notes as one list, the newest first. */
export function libraryEntries(
  outputs: readonly StudioOutput[],
  notes: readonly Note[]
): LibraryEntry[] {
  const entries: LibraryEntry[] = [
    ...outputs.map((output): LibraryEntry => ({ type: ENTRY.OUTPUT, output })),
    ...notes.map((note): LibraryEntry => ({ type: ENTRY.NOTE, note })),
  ];
  return entries.sort((a, b) => entryTime(b).localeCompare(entryTime(a)));
}
