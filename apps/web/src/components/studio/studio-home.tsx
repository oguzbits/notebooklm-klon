import type { CreateStudioBody, SourceSummary } from '@nlm/shared';
import { NotebookText } from 'lucide-react';

import { QueryBoundary } from '@/components/query-boundary';
import { OutputRowsSkeleton } from '@/components/skeletons';
import { CreateTile } from '@/components/studio/studio-create-tile';
import { KIND_LABEL } from '@/components/studio/studio-labels';
import { EmptyLibrary, type LibraryActions, LibraryRows } from '@/components/studio/studio-library';
import { PendingRow, RetryAlert } from '@/components/studio/studio-pending';
import { TILE_ORDER } from '@/components/studio/studio-tiles';
import { Button } from '@/components/ui/button';
import type { useCreateWrittenNote, useDeleteNote, useNotes } from '@/hooks/use-notes';
import type { useCreateStudioOutput, useDeleteStudioOutput } from '@/hooks/use-studio';
import type { useStudioLibrary } from '@/hooks/use-studio-library';

type Library = ReturnType<typeof useStudioLibrary>;
type Create = ReturnType<typeof useCreateStudioOutput>;
type Remove = ReturnType<typeof useDeleteStudioOutput>;
type RemoveNote = ReturnType<typeof useDeleteNote>;
type AddNote = ReturnType<typeof useCreateWrittenNote>;
type Notes = ReturnType<typeof useNotes>;

/** What is being made right now: a new note, or an output with the number of sources behind it. */
function PendingRows({
  addNote,
  create,
  usableCount,
}: {
  addNote: AddNote;
  create: Create;
  usableCount: number;
}) {
  return (
    <>
      {addNote.isPending && (
        <PendingRow>
          <span className="min-w-0 truncate text-small">Notiz wird erstellt …</span>
        </PendingRow>
      )}
      {create.isPending && (
        <PendingRow>
          <span className="min-w-0 text-small">
            <span className="block truncate">
              {create.variables ? KIND_LABEL[create.variables.kind] : 'Ausgabe'} wird erstellt …
            </span>
            <span className="block truncate text-muted-foreground">
              basierend auf {usableCount} {usableCount === 1 ? 'Quelle' : 'Quellen'}
            </span>
          </span>
        </PendingRow>
      )}
    </>
  );
}

/** The failures of the list that are not the list itself failing. */
function LibraryErrors({
  notes,
  addNote,
  failedDelete,
  noteBlocked,
  onStartNote,
}: {
  notes: Notes;
  addNote: AddNote;
  failedDelete: unknown;
  noteBlocked: boolean;
  onStartNote: () => void;
}) {
  return (
    <>
      {notes.isError && <RetryAlert error={notes.error} />}
      {addNote.isError && (
        <RetryAlert error={addNote.error} onRetry={onStartNote} disabled={noteBlocked} />
      )}
      {failedDelete ? <RetryAlert error={failedDelete} /> : null}
    </>
  );
}

interface StudioHomeProps {
  library: Library;
  sources: { usable: SourceSummary[]; loaded: boolean };
  create: Create;
  remove: Remove;
  removeNote: RemoveNote;
  addNote: AddNote;
  /** The line whose deletion is under way. */
  deletingId: string | null;
  actions: LibraryActions & { onStartNote: () => void; onCreate: (body: CreateStudioBody) => void };
}

/** The tiles that make something, with the hint and the failure of the last attempt. */
function CreateSection({
  sources,
  create,
  blocked,
  onCreate,
}: {
  sources: StudioHomeProps['sources'];
  create: Create;
  blocked: boolean;
  onCreate: (body: CreateStudioBody) => void;
}) {
  const { variables } = create;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {TILE_ORDER.map((kind) => (
          <CreateTile
            key={kind}
            kind={kind}
            compact={false}
            sources={sources.usable}
            disabled={blocked}
            onCreate={onCreate}
          />
        ))}
      </div>
      {sources.usable.length === 0 && sources.loaded && (
        <p className="text-small text-muted-foreground">
          Wähle mindestens eine fertig gelesene Quelle aus, um etwas zu erstellen.
        </p>
      )}
      {create.isError && (
        <RetryAlert
          error={create.error}
          onRetry={variables && (() => onCreate(variables))}
          disabled={create.isPending}
        />
      )}
    </>
  );
}

/** The button for a new note, floating over the lower edge, and the fade of the list under it. */
function AddNoteBar({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <>
      <Button
        variant="secondary"
        size="xl"
        disabled={disabled}
        onClick={onClick}
        className="absolute bottom-[18px] left-1/2 z-10 -translate-x-1/2 shadow-glow"
      >
        <NotebookText />
        Notiz hinzufügen
      </Button>
      {/* The list fades out above the lower edge of the panel, padding included. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-2 -bottom-2 -left-2 h-7 rounded-b-panel bg-gradient-to-t from-card from-0% via-card/98 via-10% to-transparent"
      />
    </>
  );
}

/** The Studio while nothing is open: the tiles, what was made, and the button for a new note. */
export function StudioHome({
  library,
  sources,
  create,
  remove,
  removeNote,
  addNote,
  deletingId,
  actions,
}: StudioHomeProps) {
  const { outputs, notes, entries } = library;
  const noteBlocked = addNote.isPending || notes.isPending;
  const blocked = sources.usable.length === 0 || create.isPending;

  return (
    <div className="relative h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-16">
        <CreateSection
          sources={sources}
          create={create}
          blocked={blocked}
          onCreate={actions.onCreate}
        />
        <section aria-label="Erstellte Ausgaben" className="flex flex-col gap-1">
          <PendingRows addNote={addNote} create={create} usableCount={sources.usable.length} />
          <QueryBoundary
            query={outputs}
            loading={<OutputRowsSkeleton />}
            isEmpty={() => entries.length === 0}
            empty={!create.isPending && !notes.isPending && <EmptyLibrary />}
          >
            {() => <LibraryRows entries={entries} deletingId={deletingId} actions={actions} />}
          </QueryBoundary>
          <LibraryErrors
            notes={notes}
            addNote={addNote}
            failedDelete={remove.error ?? removeNote.error}
            noteBlocked={noteBlocked}
            onStartNote={actions.onStartNote}
          />
        </section>
      </div>
      <AddNoteBar disabled={noteBlocked} onClick={actions.onStartNote} />
    </div>
  );
}
