import {
  type CreateStudioBody,
  type Note,
  SOURCE_STATUS,
  STUDIO_KIND,
  type StudioKind,
  type StudioOutput,
} from '@nlm/shared';
import {
  FileText,
  Layers,
  ListChecks,
  LoaderCircle,
  type LucideIcon,
  Network,
  NotebookText,
  RotateCw,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { OutputRowsSkeleton } from '@/components/skeletons';
import { LibraryRow } from '@/components/studio/library-row';
import { NoteViewer } from '@/components/studio/note-viewer';
import { OutputViewer } from '@/components/studio/output-viewer';
import { ReportDialog } from '@/components/studio/report-dialog';
import {
  describeOutput,
  KIND_LABEL,
  noteTitle,
  TILE_LABEL,
} from '@/components/studio/studio-labels';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDeleteNote, useNotes } from '@/hooks/use-notes';
import { useSources } from '@/hooks/use-sources';
import { useCreateStudioOutput, useDeleteStudioOutput, useStudioOutputs } from '@/hooks/use-studio';
import { describeError } from '@/lib/messages';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<StudioKind, LucideIcon> = {
  [STUDIO_KIND.REPORT]: FileText,
  [STUDIO_KIND.FLASHCARDS]: Layers,
  [STUDIO_KIND.QUIZ]: ListChecks,
  [STUDIO_KIND.MINDMAP]: Network,
};

/** Each format has its own icon color, like in the original. */
const KIND_COLOR: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'text-studio-pink',
  [STUDIO_KIND.FLASHCARDS]: 'text-studio-warm',
  [STUDIO_KIND.QUIZ]: 'text-studio-teal',
  [STUDIO_KIND.MINDMAP]: 'text-studio-purple',
};

const TILE =
  'flex h-12 w-full items-center gap-1 rounded-xl bg-tile pr-3 pl-2 text-left text-small ring-1 ring-inset ring-[var(--tile-ring)] transition-transform duration-200 ease-[cubic-bezier(0.05,0.7,0.1,1)] hover:scale-[0.985] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50';

/** What a tile says when the pointer rests on it, worded like the original. */
const KIND_TIP: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'Berichte auf Grundlage deiner Quellen erstellen',
  [STUDIO_KIND.FLASHCARDS]: 'Karteikarten mithilfe von KI basierend auf deinen Quellen erstellen',
  [STUDIO_KIND.QUIZ]: 'Interaktives Quiz auf Grundlage deiner Quellen mit KI erstellen',
  [STUDIO_KIND.MINDMAP]: 'Mindmap mithilfe von KI erstellen, basierend auf deinen Quellen',
};

function Tile({ kind, children, ...props }: { kind: StudioKind } & React.ComponentProps<'button'>) {
  const Icon = KIND_ICON[kind];
  return (
    <Tooltip>
      {/* The span keeps the tooltip alive while the tile is disabled (a disabled button gets no pointer events). */}
      <TooltipTrigger asChild>
        <span className="flex">
          <button type="button" className={TILE} {...props}>
            <span className="flex size-10 shrink-0 items-center justify-center">
              <Icon className={cn('size-6', KIND_COLOR[kind])} aria-hidden />
            </span>
            {children ?? TILE_LABEL[kind]}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{KIND_TIP[kind]}</TooltipContent>
    </Tooltip>
  );
}

const ENTRY = { OUTPUT: 'OUTPUT', NOTE: 'NOTE' } as const;
type OpenEntry = { type: (typeof ENTRY)[keyof typeof ENTRY]; id: string };
/** A line of the list: something the Studio made, or a saved answer. */
type LibraryEntry =
  { type: typeof ENTRY.OUTPUT; output: StudioOutput } | { type: typeof ENTRY.NOTE; note: Note };

const entryTime = (entry: LibraryEntry) =>
  entry.type === ENTRY.OUTPUT ? entry.output.createdAt : entry.note.createdAt;

/** What the list says while it is empty: the place where the Studio keeps what it makes. */
function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
      <WandSparkles className="size-8 text-link" aria-hidden />
      <p className="text-[0.875rem] leading-6 font-[500] text-link">
        Hier wird die Ausgabe von Studio gespeichert.
      </p>
      <p className="text-[0.875rem] leading-6 text-muted-foreground">
        Nachdem du Quellen hinzugefügt hast, klicke oben, um Berichte, Karteikarten, Quizze und
        Mindmaps zu erstellen.
      </p>
    </div>
  );
}

/** The right column: make reports, flashcards, quizzes and mind maps; open them; keep notes. */
export function StudioPanel({
  notebookId,
  onOpenCitation,
  onViewingChange,
}: {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
  /** Tells the page whether an output is open, because the Studio grows while one is. */
  onViewingChange?: (viewing: boolean) => void;
}) {
  const outputs = useStudioOutputs(notebookId);
  const sources = useSources(notebookId);
  const create = useCreateStudioOutput(notebookId);
  const remove = useDeleteStudioOutput(notebookId);
  const notes = useNotes(notebookId);
  const removeNote = useDeleteNote(notebookId);
  const [open, setOpen] = useState<OpenEntry | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const usableCount = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  const usable = usableCount > 0;
  const openedOutput =
    open?.type === ENTRY.OUTPUT ? outputs.data?.find((output) => output.id === open.id) : undefined;
  const openedNote =
    open?.type === ENTRY.NOTE ? notes.data?.find((note) => note.id === open.id) : undefined;
  const viewing = openedOutput !== undefined || openedNote !== undefined;
  useEffect(() => {
    onViewingChange?.(viewing);
  }, [viewing, onViewingChange]);

  const make = (body: CreateStudioBody) =>
    create.mutate(body, { onSuccess: (output) => setOpen({ type: ENTRY.OUTPUT, id: output.id }) });
  const blocked = !usable || create.isPending;

  const entries: LibraryEntry[] = [
    ...(outputs.data ?? []).map((output): LibraryEntry => ({ type: ENTRY.OUTPUT, output })),
    ...(notes.data ?? []).map((note): LibraryEntry => ({ type: ENTRY.NOTE, note })),
  ].sort((a, b) => entryTime(b).localeCompare(entryTime(a)));

  const deleteNoteDialog = (
    <ConfirmDialog
      open={noteToDelete !== null}
      onOpenChange={(isOpen) => !isOpen && setNoteToDelete(null)}
      title="Notiz löschen?"
      description="Die Notiz wird gelöscht. Die Antwort im Chat bleibt erhalten."
      pending={removeNote.isPending}
      onConfirm={() =>
        noteToDelete &&
        removeNote.mutate(noteToDelete, {
          onSuccess: () => {
            setNoteToDelete(null);
            setOpen(null);
          },
        })
      }
    />
  );

  if (openedOutput) {
    return (
      <OutputViewer
        notebookId={notebookId}
        output={openedOutput}
        deleting={remove.isPending}
        onBack={() => setOpen(null)}
        onDelete={() => remove.mutate(openedOutput.id, { onSuccess: () => setOpen(null) })}
        onOpenCitation={onOpenCitation}
      />
    );
  }
  if (openedNote) {
    return (
      <>
        <NoteViewer
          notebookId={notebookId}
          note={openedNote}
          deleting={removeNote.isPending}
          onBack={() => setOpen(null)}
          onDelete={() => setNoteToDelete(openedNote.id)}
          onOpenCitation={onOpenCitation}
        />
        {deleteNoteDialog}
      </>
    );
  }

  return (
    <div className="relative h-full min-h-0">
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-2">
        <div className="grid grid-cols-2 gap-2">
          <ReportDialog onCreate={(format) => make({ kind: STUDIO_KIND.REPORT, format })}>
            <Tile kind={STUDIO_KIND.REPORT} disabled={blocked} />
          </ReportDialog>
          <Tile
            kind={STUDIO_KIND.FLASHCARDS}
            disabled={blocked}
            onClick={() => make({ kind: STUDIO_KIND.FLASHCARDS })}
          />
          <Tile
            kind={STUDIO_KIND.QUIZ}
            disabled={blocked}
            onClick={() => make({ kind: STUDIO_KIND.QUIZ })}
          />
          <Tile
            kind={STUDIO_KIND.MINDMAP}
            disabled={blocked}
            onClick={() => make({ kind: STUDIO_KIND.MINDMAP })}
          />
        </div>
        {!usable && sources.isSuccess && (
          <p className="text-small text-muted-foreground">
            Wähle mindestens eine fertig gelesene Quelle aus, um etwas zu erstellen.
          </p>
        )}

        {create.isError && (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-col items-start gap-2">
              <p>{describeError(create.error)}</p>
              {create.variables && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={create.isPending}
                  onClick={() => make(create.variables)}
                >
                  <RotateCw />
                  Erneut versuchen
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <section aria-label="Erstellte Ausgaben" className="flex flex-col gap-1">
          {create.isPending && (
            <Skeleton
              role="status"
              className="flex h-16 items-center gap-2 rounded-2xl p-3 [--shimmer-base:var(--source-guide)] [--shimmer-edge:color-mix(in_srgb,var(--source-guide),var(--card)_60%)]"
            >
              <span className="flex size-8 shrink-0 items-center justify-center">
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              </span>
              <span className="min-w-0 text-small">
                <span className="block truncate">
                  {create.variables ? KIND_LABEL[create.variables.kind] : 'Ausgabe'} wird erstellt …
                </span>
                <span className="block truncate text-muted-foreground">
                  basierend auf {usableCount} {usableCount === 1 ? 'Quelle' : 'Quellen'}
                </span>
              </span>
            </Skeleton>
          )}
          <QueryBoundary
            query={outputs}
            loading={<OutputRowsSkeleton />}
            isEmpty={() => entries.length === 0}
            empty={!create.isPending && !notes.isPending && <EmptyLibrary />}
          >
            {() => (
              <ul className="flex flex-col gap-1">
                {entries.map((entry) =>
                  entry.type === ENTRY.OUTPUT ? (
                    <LibraryRow
                      key={entry.output.id}
                      icon={KIND_ICON[entry.output.kind]}
                      iconClassName={KIND_COLOR[entry.output.kind]}
                      title={entry.output.title}
                      subtitle={`${describeOutput(entry.output)} · ${relativeTime(entry.output.createdAt)}`}
                      deleting={remove.isPending && remove.variables === entry.output.id}
                      onOpen={() => setOpen({ type: ENTRY.OUTPUT, id: entry.output.id })}
                      onDelete={() => remove.mutate(entry.output.id)}
                    />
                  ) : (
                    <LibraryRow
                      key={entry.note.id}
                      icon={NotebookText}
                      iconClassName="text-foreground"
                      title={noteTitle(entry.note)}
                      subtitle={`Notiz · ${relativeTime(entry.note.createdAt)}`}
                      deleting={removeNote.isPending && noteToDelete === entry.note.id}
                      onOpen={() => setOpen({ type: ENTRY.NOTE, id: entry.note.id })}
                      onDelete={() => setNoteToDelete(entry.note.id)}
                    />
                  )
                )}
              </ul>
            )}
          </QueryBoundary>
          {notes.isError && (
            <Alert variant="destructive">
              <AlertDescription>{describeError(notes.error)}</AlertDescription>
            </Alert>
          )}
          {(remove.isError || removeNote.isError) && (
            <Alert variant="destructive">
              <AlertDescription>{describeError(remove.error ?? removeNote.error)}</AlertDescription>
            </Alert>
          )}
        </section>
      </div>
      {/* The list fades out above the lower edge of the panel, padding included. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-2 -bottom-2 -left-2 h-7 rounded-b-panel bg-gradient-to-t from-card from-0% via-card/98 via-10% to-transparent"
      />
      {deleteNoteDialog}
    </div>
  );
}
