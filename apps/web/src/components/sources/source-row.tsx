import { SOURCE_KIND, SOURCE_STATUS, type SourceKind, type SourceSummary } from '@nlm/shared';
import {
  ChevronDown,
  EllipsisVertical,
  FileText,
  Globe,
  LoaderCircle,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';

import { SourceOverview } from '@/components/sources/source-overview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FAILURE_MESSAGE, STATUS_LABEL } from '@/lib/messages';
import { cn } from '@/lib/utils';

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

function KindIcon({ kind }: { kind: SourceKind }) {
  const Icon = kind === SOURCE_KIND.URL ? Globe : FileText;
  return <Icon className="size-6 shrink-0 text-muted-foreground" aria-hidden />;
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
  const [showOverview, setShowOverview] = useState(false);
  const ready = source.status === SOURCE_STATUS.READY;
  const failed = source.status === SOURCE_STATUS.FAILED;
  const working = !ready && !failed;

  return (
    <li className="group/row veil rounded-lg px-2 py-1">
      <div className="flex min-h-9 items-center gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left text-[0.875rem] leading-6 disabled:cursor-default"
          disabled={!ready}
          onClick={onOpen}
          title={ready ? 'Text der Quelle anzeigen' : undefined}
        >
          <KindIcon kind={source.kind} />
          <span className="truncate">{source.title}</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Weitere Aktionen für „${source.title}“`}
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
          </DropdownMenuContent>
        </DropdownMenu>
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
      {ready && (
        <div className="mb-1 ml-9 flex flex-col gap-2">
          <button
            type="button"
            className="flex items-center gap-1 self-start rounded-md text-small text-muted-foreground hover:text-foreground"
            aria-expanded={showOverview}
            aria-label={`Übersicht von „${source.title}“ ${showOverview ? 'ausblenden' : 'anzeigen'}`}
            onClick={() => setShowOverview((value) => !value)}
          >
            <ChevronDown
              className={cn('size-3 transition-transform', showOverview && 'rotate-180')}
              aria-hidden
            />
            Übersicht
            {source.pageCount !== null && ` · ${source.pageCount} Seiten`}
          </button>
          {showOverview && <SourceOverview notebookId={notebookId} sourceId={source.id} />}
        </div>
      )}
    </li>
  );
}
