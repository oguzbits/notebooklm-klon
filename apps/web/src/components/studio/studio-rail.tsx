import type { SourceSummary } from '@nlm/shared';
import { NotebookText } from 'lucide-react';

import { CreateTile } from '@/components/studio/studio-create-tile';
import { RailButton, RailEntries } from '@/components/studio/studio-library';
import { TILE_ORDER } from '@/components/studio/studio-tiles';
import type { useStudioActions } from '@/hooks/use-studio-actions';
import type { useStudioLibrary } from '@/hooks/use-studio-library';

/** What stays visible when the column is folded: the tiles, one symbol per line, a new note. */
export function StudioRail({
  library,
  sources,
  studio,
}: {
  library: ReturnType<typeof useStudioLibrary>;
  sources: SourceSummary[];
  studio: ReturnType<typeof useStudioActions>;
}) {
  // Nothing can be made now: no usable source, or something is being made.
  const blocked = sources.length === 0 || studio.create.isPending;
  return (
    <>
      {TILE_ORDER.map((kind) => (
        <CreateTile
          key={kind}
          kind={kind}
          compact
          sources={sources}
          disabled={blocked}
          onCreate={studio.create.mutate}
        />
      ))}
      <RailEntries entries={library.entries} onOpen={studio.openEntry} />
      <RailButton
        icon={<NotebookText className="size-6" aria-hidden />}
        title="Notiz hinzufügen"
        disabled={studio.addNote.isPending || library.notes.isPending}
        onClick={studio.startNote}
        className="mt-auto mb-4"
      />
    </>
  );
}
