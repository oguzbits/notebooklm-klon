import { SOURCE_STATUS } from '@nlm/shared';
import { memo, useState } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { SourceRowsSkeleton } from '@/components/skeletons';
import { AddSourceDialog } from '@/components/sources/add-source-dialog';
import { EmptySources, SourceList } from '@/components/sources/source-list';
import { SourcesToolbar } from '@/components/sources/sources-toolbar';
import { WebSearchBox } from '@/components/sources/web-search-box';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRemoveSource, useSources, useToggleSource } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';
import { SOURCE_SORT, type SourceSort } from '@/lib/sort-sources';

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
      <WebSearchBox notebookId={notebookId} />
      <QueryBoundary
        query={sources}
        loading={<SourceRowsSkeleton />}
        isEmpty={(list) => list.length === 0}
        empty={<EmptySources />}
      >
        {(list) => (
          <>
            {ready.length > 0 && (
              <SourcesToolbar
                sort={sort}
                onSort={setSort}
                allSelected={allSelected}
                busy={toggle.isPending}
                onSelectAll={selectAll}
              />
            )}
            <SourceList
              notebookId={notebookId}
              sources={list}
              sort={sort}
              toggle={toggle}
              remove={remove}
              onOpen={onOpenSource}
            />
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
