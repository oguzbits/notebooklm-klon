import type { CreateStudioBody, SourceSummary } from '@nlm/shared';
import { NotebookText } from 'lucide-react';

import { CreateTile } from '@/components/studio/studio-create-tile';
import { RailButton, RailEntries } from '@/components/studio/studio-library';
import { TILE_ORDER } from '@/components/studio/studio-tiles';
import type { LibraryEntry, OpenEntry } from '@/lib/library-entries';

/** What stays visible when the column is folded: the tiles, one symbol per line, a new note. */
export function StudioRail({
  entries,
  sources,
  blocked,
  noteBlocked,
  onCreate,
  onOpen,
  onStartNote,
}: {
  entries: LibraryEntry[];
  sources: SourceSummary[];
  /** Nothing can be made now: no usable source, or something is being made. */
  blocked: boolean;
  noteBlocked: boolean;
  onCreate: (body: CreateStudioBody) => void;
  onOpen: (entry: OpenEntry) => void;
  onStartNote: () => void;
}) {
  return (
    <>
      {TILE_ORDER.map((kind) => (
        <CreateTile
          key={kind}
          kind={kind}
          compact
          sources={sources}
          disabled={blocked}
          onCreate={onCreate}
        />
      ))}
      <RailEntries entries={entries} onOpen={onOpen} />
      <RailButton
        icon={<NotebookText className="size-6" aria-hidden />}
        title="Notiz hinzufügen"
        disabled={noteBlocked}
        onClick={onStartNote}
        className="mt-auto mb-4"
      />
    </>
  );
}
