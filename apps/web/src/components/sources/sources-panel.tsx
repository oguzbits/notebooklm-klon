import { SOURCE_STATUS } from '@nlm/shared';
import { ArrowDownWideNarrow, FileQuestion } from 'lucide-react';
import { memo, useState } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { SourceRowsSkeleton } from '@/components/skeletons';
import { AddSourceDialog } from '@/components/sources/add-source-dialog';
import { SourceRow } from '@/components/sources/source-row';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRemoveSource, useSources, useToggleSource } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';
import { sortSources, SOURCE_SORT, type SourceSort } from '@/lib/sort-sources';

const SORT_CHOICES = [
  [SOURCE_SORT.LATEST, 'Letzte'],
  [SOURCE_SORT.TITLE, 'Titel'],
  [SOURCE_SORT.TYPE, 'Typ'],
] as const;

/** The left column: add sources, choose which ones answers may use, open one to read it. */
export const SourcesPanel = memo(function SourcesPanel({
  notebookId,
  onOpenSource,
}: {
  notebookId: string;
  onOpenSource: (sourceId: string) => void;
}) {
  const sources = useSources(notebookId);
  const [sort, setSort] = useState<SourceSort>(SOURCE_SORT.ADDED);
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
    <div className="flex h-full flex-col gap-2 overflow-y-auto pt-4 pb-2">
      <AddSourceDialog notebookId={notebookId} />
      <QueryBoundary
        query={sources}
        loading={<SourceRowsSkeleton />}
        isEmpty={(list) => list.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <FileQuestion className="size-10 text-muted-foreground" aria-hidden />
            <p className="text-ui font-title">Noch keine Quellen</p>
            <p className="text-small text-muted-foreground">
              Lade eine Datei hoch, füge eine Webseite oder einen Text hinzu, um Fragen zu stellen.
            </p>
          </div>
        }
      >
        {(list) => (
          <>
            {ready.length > 0 && (
              <div className="flex h-10 items-center justify-between gap-3 py-1 pr-2 pl-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-8"
                      aria-label="Quellen sortieren"
                      tooltip="Quellen sortieren"
                    >
                      <ArrowDownWideNarrow />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuRadioGroup
                      value={sort}
                      onValueChange={(value) => setSort(value as SourceSort)}
                    >
                      {SORT_CHOICES.map(([value, label]) => (
                        <DropdownMenuRadioItem key={value} value={value}>
                          {label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <label className="flex items-center gap-3 text-[0.875rem] leading-6">
                  Alle auswählen
                  <Checkbox
                    checked={allSelected}
                    disabled={toggle.isPending}
                    onCheckedChange={(checked) => selectAll(checked === true)}
                    aria-label="Alle Quellen auswählen"
                  />
                </label>
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {sortSources(list, sort).map((source) => (
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
});
