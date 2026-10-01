import { type CreateStudioBody, type Note, SOURCE_STATUS, type StudioOutput } from '@nlm/shared';
import {
  ChevronRight,
  LoaderCircle,
  type LucideIcon,
  Minimize2,
  NotebookText,
  RotateCw,
  WandSparkles,
} from 'lucide-react';
import { type ReactNode, useEffect, useState, useTransition } from 'react';

import { Panel } from '@/components/notebook/panel';
import { QueryBoundary } from '@/components/query-boundary';
import { OutputRowsSkeleton } from '@/components/skeletons';
import { CreateDialog } from '@/components/studio/create-dialog';
import { LibraryRow } from '@/components/studio/library-row';
import { NoteViewer } from '@/components/studio/note-viewer';
import { OutputViewer } from '@/components/studio/output-viewer';
import {
  CLOSE_NOTE_LABEL,
  CLOSE_VIEW_LABEL,
  describeOutput,
  KIND_LABEL,
  noteTitle,
} from '@/components/studio/studio-labels';
import { KIND_COLOR, KIND_ICON, Tile, TILE_ORDER } from '@/components/studio/studio-tiles';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteNote, useNotes } from '@/hooks/use-notes';
import { useSources } from '@/hooks/use-sources';
import {
  useCreateStudioOutput,
  useDeleteStudioOutput,
  useStudioOutputs,
  useUpdateStudioOutput,
} from '@/hooks/use-studio';
import { describeError } from '@/lib/messages';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

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

/** What an output or a note is on the rail of the folded column: its symbol. */
function RailButton({
  icon: Icon,
  iconClassName,
  title,
  onClick,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="icon-lg" aria-label={title} tooltip={title} onClick={onClick}>
      <Icon className={cn('size-6', iconClassName)} aria-hidden />
    </Button>
  );
}

/** The path back in the header of the column while something is open: "Studio › Notiz". */
function ViewerPath({ crumb, onBack }: { crumb: string; onBack: () => void }) {
  return (
    <nav aria-label="Pfad" className="flex min-w-0 items-center gap-1 text-ui">
      <button type="button" aria-label="Zurück zum Studio" onClick={onBack} className="rounded-md">
        Studio
      </button>
      <ChevronRight className="size-5 shrink-0" aria-hidden />
      <span className="truncate" aria-current="page">
        {crumb}
      </span>
    </nav>
  );
}

/**
 * The right column: make reports, flashcards, quizzes and mind maps; open them; keep notes. It owns
 * its panel, because an open thing writes its own path into the header ("Studio › Notiz") and takes
 * the place of the fold button there.
 */
export function StudioPanel({
  notebookId,
  collapsed,
  onToggle,
  onExpand,
  className,
  onOpenCitation,
  onAsk,
  onViewingChange,
}: {
  notebookId: string;
  collapsed: boolean;
  onToggle: () => void;
  /** Opens the folded column, for a symbol on the rail that leads to something inside it. */
  onExpand: () => void;
  className?: string;
  onOpenCitation: (chunkId: string) => void;
  /** Asks the chat a question: a card or a quiz question is explained there. */
  onAsk: (question: string) => void;
  /** Tells the page whether something is open, because the Studio grows while it is. */
  onViewingChange?: (viewing: boolean) => void;
}) {
  const outputs = useStudioOutputs(notebookId);
  const sources = useSources(notebookId);
  const create = useCreateStudioOutput(notebookId);
  const remove = useDeleteStudioOutput(notebookId);
  const update = useUpdateStudioOutput(notebookId);
  const notes = useNotes(notebookId);
  const removeNote = useDeleteNote(notebookId);
  const [open, setOpen] = useState<OpenEntry | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const usableSources = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  );
  const usableCount = usableSources.length;
  const usable = usableCount > 0;
  const openedOutput =
    open?.type === ENTRY.OUTPUT ? outputs.data?.find((output) => output.id === open.id) : undefined;
  const openedNote =
    open?.type === ENTRY.NOTE ? notes.data?.find((note) => note.id === open.id) : undefined;
  const viewing = openedOutput !== undefined || openedNote !== undefined;
  useEffect(() => {
    onViewingChange?.(viewing);
  }, [viewing, onViewingChange]);

  // The column changes its width when something opens in it. That is told first and at once; the
  // content follows as a transition, so the heavy render of a view does not eat the start of the move.
  const show = (entry: OpenEntry | null) => {
    onViewingChange?.(entry !== null);
    startTransition(() => setOpen(entry));
  };

  // The result is not opened by itself: it joins the list with a blue dot, and the reader opens it.
  const make = (body: CreateStudioBody) => create.mutate(body);
  const blocked = !usable || create.isPending;

  const entries: LibraryEntry[] = [
    ...(outputs.data ?? []).map((output): LibraryEntry => ({ type: ENTRY.OUTPUT, output })),
    ...(notes.data ?? []).map((note): LibraryEntry => ({ type: ENTRY.NOTE, note })),
  ].sort((a, b) => entryTime(b).localeCompare(entryTime(a)));

  const tile = (kind: (typeof TILE_ORDER)[number], compact: boolean) => (
    <CreateDialog key={kind} kind={kind} sources={usableSources} onCreate={make}>
      <Tile kind={kind} compact={compact} disabled={blocked} />
    </CreateDialog>
  );

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
            show(null);
          },
        })
      }
    />
  );

  const openEntry = (entry: OpenEntry) => {
    onExpand();
    show(entry);
    // The blue dot goes out once the output was opened.
    const output =
      entry.type === ENTRY.OUTPUT ? outputs.data?.find((item) => item.id === entry.id) : undefined;
    if (output?.unread) update.mutate({ outputId: output.id, changes: { read: true } });
  };
  const back = () => show(null);

  let content: ReactNode;
  let header: ReactNode;
  let close: ReactNode;
  if (openedOutput || openedNote) {
    const crumb = openedOutput ? KIND_LABEL[openedOutput.kind] : 'Notiz';
    const closeLabel = openedOutput ? CLOSE_VIEW_LABEL[openedOutput.kind] : CLOSE_NOTE_LABEL;
    header = <ViewerPath crumb={crumb} onBack={back} />;
    close = (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={closeLabel}
        tooltip={closeLabel}
        onClick={back}
      >
        <Minimize2 />
      </Button>
    );
  }
  if (openedOutput) {
    content = (
      <OutputViewer
        notebookId={notebookId}
        output={openedOutput}
        deleting={remove.isPending}
        onDelete={() => remove.mutate(openedOutput.id, { onSuccess: () => show(null) })}
        onOpenCitation={onOpenCitation}
        onAsk={onAsk}
      />
    );
  } else if (openedNote) {
    content = (
      <NoteViewer
        notebookId={notebookId}
        note={openedNote}
        deleting={removeNote.isPending}
        onDelete={() => setNoteToDelete(openedNote.id)}
        onOpenCitation={onOpenCitation}
      />
    );
  } else {
    content = (
      <div className="relative h-full min-h-0">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pb-2">
          <div className="grid grid-cols-2 gap-2">
            {TILE_ORDER.map((kind) => tile(kind, false))}
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
                    {create.variables ? KIND_LABEL[create.variables.kind] : 'Ausgabe'} wird erstellt
                    …
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
                        subtitle={[
                          describeOutput(entry.output),
                          relativeTime(entry.output.createdAt),
                        ]
                          .filter((part) => part !== '')
                          .join(' · ')}
                        unread={entry.output.unread}
                        deleting={remove.isPending && remove.variables === entry.output.id}
                        onOpen={() => openEntry({ type: ENTRY.OUTPUT, id: entry.output.id })}
                        onDelete={() => remove.mutate(entry.output.id)}
                      />
                    ) : (
                      <LibraryRow
                        key={entry.note.id}
                        icon={NotebookText}
                        iconClassName="text-foreground"
                        title={noteTitle(entry.note)}
                        subtitle={relativeTime(entry.note.createdAt)}
                        deleting={removeNote.isPending && noteToDelete === entry.note.id}
                        onOpen={() => openEntry({ type: ENTRY.NOTE, id: entry.note.id })}
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
                <AlertDescription>
                  {describeError(remove.error ?? removeNote.error)}
                </AlertDescription>
              </Alert>
            )}
          </section>
        </div>
        {/* The list fades out above the lower edge of the panel, padding included. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-2 -left-2 h-7 rounded-b-panel bg-gradient-to-t from-card from-0% via-card/98 via-10% to-transparent"
        />
      </div>
    );
  }

  const rail = (
    <>
      {TILE_ORDER.map((kind) => tile(kind, true))}
      {entries.map((entry) =>
        entry.type === ENTRY.OUTPUT ? (
          <RailButton
            key={entry.output.id}
            icon={KIND_ICON[entry.output.kind]}
            iconClassName={KIND_COLOR[entry.output.kind]}
            title={entry.output.title}
            onClick={() => openEntry({ type: ENTRY.OUTPUT, id: entry.output.id })}
          />
        ) : (
          <RailButton
            key={entry.note.id}
            icon={NotebookText}
            title={noteTitle(entry.note)}
            onClick={() => openEntry({ type: ENTRY.NOTE, id: entry.note.id })}
          />
        )
      )}
    </>
  );

  return (
    <Panel
      title="Studio"
      side="right"
      collapsed={collapsed}
      onToggle={onToggle}
      header={header}
      action={close}
      rail={rail}
      className={className}
    >
      {content}
      {deleteNoteDialog}
    </Panel>
  );
}
