import type { Note, StudioOutput } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { ENTRY, libraryEntries } from './library-entries';

const output = (id: string, createdAt: string) => ({ id, createdAt }) as StudioOutput;
const note = (id: string, createdAt: string) => ({ id, createdAt }) as Note;

describe('libraryEntries', () => {
  it('merges outputs and notes, the newest first', () => {
    const entries = libraryEntries(
      [output('a', '2026-10-01T10:00:00Z'), output('c', '2026-10-01T12:00:00Z')],
      [note('b', '2026-10-01T11:00:00Z')]
    );

    expect(
      entries.map((entry) => (entry.type === ENTRY.OUTPUT ? entry.output.id : entry.note.id))
    ).toEqual(['c', 'b', 'a']);
  });
});
