import {
  type CreateStudioBody,
  SOURCE_STATUS,
  STUDIO_KIND,
  type StudioKind,
  type StudioOutput,
} from '@nlm/shared';
import {
  EllipsisVertical,
  FileText,
  Layers,
  ListChecks,
  LoaderCircle,
  type LucideIcon,
  Network,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { NotesSection } from '@/components/notes/notes-panel';
import { QueryBoundary } from '@/components/query-boundary';
import { OutputViewer } from '@/components/studio/output-viewer';
import { ReportDialog } from '@/components/studio/report-dialog';
import { describeOutput, KIND_LABEL } from '@/components/studio/studio-labels';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
            {children ?? KIND_LABEL[kind]}
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{KIND_TIP[kind]}</TooltipContent>
    </Tooltip>
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
  const [openId, setOpenId] = useState<string | null>(null);

  const usableCount = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  const usable = usableCount > 0;
  const opened = outputs.data?.find((output) => output.id === openId);
  const viewing = opened !== undefined;
  useEffect(() => {
    onViewingChange?.(viewing);
  }, [viewing, onViewingChange]);

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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-2">
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
          <div
            role="status"
            className="flex h-[60px] animate-pulse items-center gap-2 rounded-xl bg-secondary p-2"
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
          </div>
        )}
        <QueryBoundary
          query={outputs}
          isEmpty={(list) => list.length === 0}
          empty={
            !create.isPending && (
              <p className="px-1 text-ui text-muted-foreground">
                Hier erscheinen deine Berichte, Karteikarten, Quizze und Mindmaps.
              </p>
            )
          }
        >
          {(list) => (
            <ul className="flex flex-col gap-1">
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
    <li className={cn('veil flex items-center rounded-xl', deleting && 'opacity-50')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            className="flex h-[60px] min-w-0 flex-1 items-center gap-2 rounded-xl p-2 text-left"
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              <Icon className={cn('size-6', KIND_COLOR[output.kind])} aria-hidden />
            </span>
            <span className="min-w-0 text-small">
              <span className="block truncate">{output.title}</span>
              <span className="block truncate text-[0.75rem] leading-4 text-muted-foreground">
                {describeOutput(output)} · {relativeTime(output.createdAt)}
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{output.title}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="mr-1"
            aria-label={`Weitere Aktionen für „${output.title}“`}
            tooltip="Mehr"
            disabled={deleting}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={deleting} onSelect={onDelete}>
            <Trash2 aria-hidden />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
