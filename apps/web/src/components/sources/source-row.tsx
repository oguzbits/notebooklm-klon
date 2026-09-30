import { SOURCE_KIND, SOURCE_STATUS, type SourceKind, type SourceSummary } from '@nlm/shared';
import { ChevronDown, FileText, Globe, LoaderCircle, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { SourceOverview } from '@/components/sources/source-overview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  return <Icon className="size-5 shrink-0 text-primary" aria-hidden />;
}

/** One source: a checkbox to use it for answers, its title (opens the text) and its status. */
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
    <li className="flex items-start gap-2 rounded-2xl px-3 py-2.5 hover:bg-secondary">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-full text-left text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
          disabled={!ready}
          onClick={onOpen}
          title={ready ? 'Text der Quelle anzeigen' : undefined}
        >
          <KindIcon kind={source.kind} />
          <span className="truncate">{source.title}</span>
        </button>
        {working && (
          <Badge variant="secondary" className="mt-1">
            <LoaderCircle className="animate-spin" aria-hidden />
            {STATUS_LABEL[source.status]}
          </Badge>
        )}
        {failed && (
          <p className="mt-1 flex items-start gap-1 text-xs text-destructive" role="alert">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
            <span>
              {source.failure ? FAILURE_MESSAGE[source.failure] : STATUS_LABEL[source.status]}{' '}
              {FAILED_HINT}
            </span>
          </p>
        )}
        {ready && (
          <div className="mt-1 flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
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
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`„${source.title}“ entfernen`}
        disabled={busy}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
      <Checkbox
        className="mt-1"
        checked={source.selected && ready}
        disabled={!ready || busy}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={`„${source.title}“ für Antworten verwenden`}
      />
    </li>
  );
}
