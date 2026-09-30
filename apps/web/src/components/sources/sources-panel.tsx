import { SOURCE_STATUS } from '@nlm/shared';
import { FileQuestion } from 'lucide-react';

import { QueryBoundary } from '@/components/query-boundary';
import { AddSourceDialog } from '@/components/sources/add-source-dialog';
import { SourceRow } from '@/components/sources/source-row';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useRemoveSource, useSources, useToggleSource } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

/** The left column: add sources, choose which ones answers may use, open one to read it. */
export function SourcesPanel({
  notebookId,
  onOpenSource,
}: {
  notebookId: string;
  onOpenSource: (sourceId: string) => void;
}) {
  const sources = useSources(notebookId);
  const toggle = useToggleSource(notebookId);
  const remove = useRemoveSource(notebookId);
  const changeError = toggle.error ?? remove.error;

  const ready = (sources.data ?? []).filter((source) => source.status === SOURCE_STATUS.READY);
  const allSelected = ready.length > 0 && ready.every((source) => source.selected);
  const selectAll = (selected: boolean) => {
    for (const source of ready) {
      if (source.selected !== selected) toggle.mutate({ sourceId: source.id, selected });
    }
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-4 pb-4">
      <AddSourceDialog notebookId={notebookId} />
      <QueryBoundary
        query={sources}
        isEmpty={(list) => list.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <FileQuestion className="size-10 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Noch keine Quellen</p>
            <p className="text-xs text-muted-foreground">
              Lade eine Datei hoch, füge eine Webseite oder einen Text hinzu, um Fragen zu stellen.
            </p>
          </div>
        }
      >
        {(list) => (
          <>
            {ready.length > 0 && (
              <label className="flex items-center justify-between gap-3 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary">
                Alle Quellen auswählen
                <Checkbox
                  checked={allSelected}
                  disabled={toggle.isPending}
                  onCheckedChange={(checked) => selectAll(checked === true)}
                  aria-label="Alle Quellen auswählen"
                />
              </label>
            )}
            <ul className="flex flex-col">
              {list.map((source) => (
                <SourceRow
                  key={source.id}
                  notebookId={notebookId}
                  source={source}
                  busy={
                    (toggle.isPending && toggle.variables?.sourceId === source.id) ||
                    (remove.isPending && remove.variables === source.id)
                  }
                  onToggle={(selected) => toggle.mutate({ sourceId: source.id, selected })}
                  onOpen={() => onOpenSource(source.id)}
                  onRemove={() => remove.mutate(source.id)}
                />
              ))}
            </ul>
          </>
        )}
      </QueryBoundary>
      {changeError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(changeError)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
