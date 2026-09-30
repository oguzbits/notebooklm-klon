import {
  type CreateStudioBody,
  REPORT_FORMAT,
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
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import { NotesSection } from '@/components/notes/notes-panel';
import { QueryBoundary } from '@/components/query-boundary';
import { OutputViewer } from '@/components/studio/output-viewer';
import { describeOutput, FORMAT_LABEL, KIND_LABEL } from '@/components/studio/studio-labels';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSources } from '@/hooks/use-sources';
import { useCreateStudioOutput, useDeleteStudioOutput, useStudioOutputs } from '@/hooks/use-studio';
import { describeError } from '@/lib/messages';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<StudioKind, LucideIcon> = {
  [STUDIO_KIND.REPORT]: FileText,
  [STUDIO_KIND.FLASHCARDS]: Layers,
  [STUDIO_KIND.QUIZ]: ListChecks,
  [STUDIO_KIND.MINDMAP]: Network,
};

const TILE =
  'group flex h-auto min-h-20 flex-col items-start justify-between gap-3 rounded-2xl bg-secondary p-4 text-left text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

function Tile({ kind, children, ...props }: { kind: StudioKind } & React.ComponentProps<'button'>) {
  const Icon = KIND_ICON[kind];
  return (
    <button type="button" className={TILE} {...props}>
      <Icon className="size-5 text-primary group-hover:text-accent-foreground" aria-hidden />
      {children ?? KIND_LABEL[kind]}
    </button>
  );
}

/** The right column: make reports, flashcards, quizzes and mind maps; open them; keep notes. */
export function StudioPanel({
  notebookId,
  onOpenCitation,
}: {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
}) {
  const outputs = useStudioOutputs(notebookId);
  const sources = useSources(notebookId);
  const create = useCreateStudioOutput(notebookId);
  const remove = useDeleteStudioOutput(notebookId);
  const [openId, setOpenId] = useState<string | null>(null);

  const usable = (sources.data ?? []).some(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  );
  const opened = outputs.data?.find((output) => output.id === openId);

  const make = (body: CreateStudioBody) =>
    create.mutate(body, { onSuccess: (output) => setOpenId(output.id) });
  const blocked = !usable || create.isPending;

  if (opened) {
    return (
      <OutputViewer
        notebookId={notebookId}
        output={opened}
        deleting={remove.isPending}
        onBack={() => setOpenId(null)}
        onDelete={() => remove.mutate(opened.id, { onSuccess: () => setOpenId(null) })}
        onOpenCitation={onOpenCitation}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto px-5 pb-5">
      <div className="grid grid-cols-2 gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Tile kind={STUDIO_KIND.REPORT} disabled={blocked} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {Object.values(REPORT_FORMAT).map((format) => (
              <DropdownMenuItem
                key={format}
                onSelect={() => make({ kind: STUDIO_KIND.REPORT, format })}
              >
                {FORMAT_LABEL[format]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
        <p className="text-sm text-muted-foreground">
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
          <p
            role="status"
            className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm"
          >
            <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
            {create.variables ? KIND_LABEL[create.variables.kind] : 'Ausgabe'} wird erstellt …
          </p>
        )}
        <QueryBoundary
          query={outputs}
          isEmpty={(list) => list.length === 0}
          empty={
            !create.isPending && (
              <p className="px-1 text-sm text-muted-foreground">
                Hier erscheinen deine Berichte, Karteikarten, Quizze und Mindmaps.
              </p>
            )
          }
        >
          {(list) => (
            <ul className="flex flex-col">
              {list.map((output) => (
                <OutputRow
                  key={output.id}
                  output={output}
                  deleting={remove.isPending && remove.variables === output.id}
                  onOpen={() => setOpenId(output.id)}
                  onDelete={() => remove.mutate(output.id)}
                />
              ))}
            </ul>
          )}
        </QueryBoundary>
        {remove.isError && (
          <Alert variant="destructive">
            <AlertDescription>{describeError(remove.error)}</AlertDescription>
          </Alert>
        )}
      </section>

      <NotesSection notebookId={notebookId} onOpenCitation={onOpenCitation} />
    </div>
  );
}

function OutputRow({
  output,
  deleting,
  onOpen,
  onDelete,
}: {
  output: StudioOutput;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const Icon = KIND_ICON[output.kind];
  return (
    <li
      className={cn(
        'flex items-center gap-1 rounded-2xl hover:bg-secondary',
        deleting && 'opacity-50'
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{output.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {describeOutput(output)}
          </span>
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`„${output.title}“ löschen`}
        disabled={deleting}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
