import { SOURCE_KIND, SOURCE_STATUS, type SourceKind, type SourceSummary } from '@nlm/shared';
import { FileText, Globe, LoaderCircle, Trash2, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FAILURE_MESSAGE, STATUS_LABEL } from '@/lib/messages';

const FAILED_HINT = 'Entferne die Quelle und füge sie noch einmal hinzu.';

interface SourceRowProps {
  source: SourceSummary;
  /** A change to this source is on its way. */
  busy: boolean;
  onToggle: (selected: boolean) => void;
  onOpen: () => void;
  onRemove: () => void;
}

function KindIcon({ kind }: { kind: SourceKind }) {
  const Icon = kind === SOURCE_KIND.URL ? Globe : FileText;
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

/** One source: a checkbox to use it for answers, its title (opens the text) and its status. */
export function SourceRow({ source, busy, onToggle, onOpen, onRemove }: SourceRowProps) {
  const ready = source.status === SOURCE_STATUS.READY;
  const failed = source.status === SOURCE_STATUS.FAILED;
  const working = !ready && !failed;

  return (
    <li className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent/50">
      <Checkbox
        className="mt-1"
        checked={source.selected && ready}
        disabled={!ready || busy}
        onCheckedChange={(checked) => onToggle(checked === true)}
        aria-label={`„${source.title}“ für Antworten verwenden`}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left text-sm font-medium disabled:cursor-default"
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
        {ready && source.pageCount !== null && (
          <p className="text-xs text-muted-foreground">{source.pageCount} Seiten</p>
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
    </li>
  );
}
