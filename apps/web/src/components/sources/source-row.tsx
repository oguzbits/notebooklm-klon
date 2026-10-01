import { SOURCE_STATUS, type SourceSummary } from '@nlm/shared';
import { EllipsisVertical, LoaderCircle, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { SourceKindIcon } from '@/components/sources/kind-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenameDialog } from '@/components/ui/rename-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRenameSource } from '@/hooks/use-sources';
import { describeError, FAILURE_MESSAGE, STATUS_LABEL } from '@/lib/messages';

const FAILED_HINT = 'Entferne die Quelle und füge sie noch einmal hinzu.';

interface SourceRowProps {
  notebookId: string;
  source: SourceSummary;
  /** A change to this source is on its way. */
  busy: boolean;
  onToggle: (selected: boolean) => void;
  onOpen: () => void;
  onRemove: () => void;
}

/**
 * One source, 36px high like in NotebookLM: its kind, the title (opens the text), a menu that
 * shows while the row is hovered or focused, and the checkbox to use it for answers.
 */
export function SourceRow({
  notebookId,
  source,
  busy,
  onToggle,
  onOpen,
  onRemove,
}: SourceRowProps) {
  const [renaming, setRenaming] = useState(false);
  const rename = useRenameSource(notebookId);
  const ready = source.status === SOURCE_STATUS.READY;
  const failed = source.status === SOURCE_STATUS.FAILED;
  const working = !ready && !failed;

  return (
    <li className="group/row veil rounded-lg px-2">
      <div className="flex h-9 items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left text-[0.875rem] leading-6"
              disabled={!ready}
              onClick={onOpen}
            >
              <SourceKindIcon kind={source.kind} />
              <span className="truncate">{source.title}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{source.title}</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Weitere Aktionen für „${source.title}“`}
              tooltip="Mehr"
              disabled={busy}
              className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100 max-wide:opacity-100"
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={busy} onSelect={onRemove}>
              <Trash2 aria-hidden />
              Quelle entfernen
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={() => setRenaming(true)}>
              <Pencil aria-hidden />
              Quelle umbenennen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <RenameDialog
          heading="Quelle umbenennen"
          label="Name der Quelle"
          value={source.title}
          open={renaming}
          onOpenChange={setRenaming}
          pending={rename.isPending}
          error={rename.isError ? describeError(rename.error) : null}
          onSave={(title, close) =>
            rename.mutate({ sourceId: source.id, title }, { onSuccess: close })
          }
        />
        <Checkbox
          checked={source.selected && ready}
          disabled={!ready || busy}
          onCheckedChange={(checked) => onToggle(checked === true)}
          aria-label={`„${source.title}“ für Antworten verwenden`}
        />
      </div>
      {working && (
        <Badge variant="secondary" className="mb-1 ml-9">
          <LoaderCircle className="animate-spin" aria-hidden />
          {STATUS_LABEL[source.status]}
        </Badge>
      )}
      {failed && (
        <p className="mb-1 ml-9 flex items-start gap-1 text-small text-destructive" role="alert">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>
            {source.failure ? FAILURE_MESSAGE[source.failure] : STATUS_LABEL[source.status]}{' '}
            {FAILED_HINT}
          </span>
        </p>
      )}
    </li>
  );
}
