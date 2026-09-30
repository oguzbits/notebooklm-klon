import { FileQuestion } from 'lucide-react';

import { QueryBoundary } from '@/components/query-boundary';
import { AddSource } from '@/components/sources/add-source';
import { SourceRow } from '@/components/sources/source-row';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useRemoveSource, useSources, useToggleSource } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

/** The left panel: add sources, choose which ones answers may use, open one to read it. */
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

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Quellen
      </h2>
      <AddSource notebookId={notebookId} />
      <Separator />
      <QueryBoundary
        query={sources}
        isEmpty={(list) => list.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <FileQuestion className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Noch keine Quellen</p>
            <p className="text-xs text-muted-foreground">
              Lade eine Datei hoch oder füge eine Webseite hinzu, um Fragen zu stellen.
            </p>
          </div>
        }
      >
        {(list) => (
          <ul className="flex flex-col">
            {list.map((source) => (
              <SourceRow
                key={source.id}
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
