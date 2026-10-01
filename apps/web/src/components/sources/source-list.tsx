import { FileQuestion } from 'lucide-react';

import { SourceRow } from '@/components/sources/source-row';
import type { useRemoveSource, useSources, useToggleSource } from '@/hooks/use-sources';
import { sortSources, type SourceSort } from '@/lib/sort-sources';

/** What the list says while there is no source. */
export function EmptySources() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <FileQuestion className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-ui font-title">Noch keine Quellen</p>
      <p className="text-small text-muted-foreground">
        Lade eine Datei hoch, füge eine Webseite oder einen Text hinzu, um Fragen zu stellen.
      </p>
    </div>
  );
}

type Sources = NonNullable<ReturnType<typeof useSources>['data']>;

/** The sources in the chosen order, each with its checkbox and menu. */
export function SourceList({
  notebookId,
  sources,
  sort,
  toggle,
  remove,
  onOpen,
}: {
  notebookId: string;
  sources: Sources;
  sort: SourceSort;
  toggle: ReturnType<typeof useToggleSource>;
  remove: ReturnType<typeof useRemoveSource>;
  onOpen: (sourceId: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {sortSources(sources, sort).map((source) => (
        <SourceRow
          key={source.id}
          notebookId={notebookId}
          source={source}
          busy={
            (toggle.isPending && toggle.variables?.sourceId === source.id) ||
            (remove.isPending && remove.variables === source.id)
          }
          onToggle={(selected) => toggle.mutate({ sourceId: source.id, selected })}
          onOpen={() => onOpen(source.id)}
          onRemove={() => remove.mutate(source.id)}
        />
      ))}
    </ul>
  );
}
