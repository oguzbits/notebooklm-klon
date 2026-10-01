import { useCallback, useState } from 'react';
import { useParams } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { ColumnTabs } from '@/components/notebook/column-tabs';
import { CustomizeNotebookDialog } from '@/components/notebook/customize-notebook-dialog';
import { NotebookActions } from '@/components/notebook/notebook-actions';
import { ChatColumn, SourcesColumn, StudioColumn } from '@/components/notebook/notebook-columns';
import { NotebookLoadFailed, NotebookNotFound } from '@/components/notebook/notebook-states';
import { NotebookTitle } from '@/components/notebook/notebook-title';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotebookLayout } from '@/hooks/use-notebook-layout';
import { useNotebook } from '@/hooks/use-notebooks';
import { useWideLayout } from '@/hooks/use-wide-layout';

/**
 * One notebook in three columns like NotebookLM: sources (or the source text) on the left, the
 * conversation in the middle, the Studio and the notes on the right. Below the wide layout one
 * column shows at a time, switched from a bar under the header.
 */
export function NotebookPage() {
  const { notebookId = '' } = useParams();
  const notebook = useNotebook(notebookId);
  const layout = useNotebookLayout();
  const [customizing, setCustomizing] = useState(false);
  // The chat is memoized, so this keeps its identity (as do the functions of the layout).
  const customize = useCallback(() => setCustomizing(true), []);
  const wide = useWideLayout();

  if (notebook.isError) {
    return (
      <NotebookLoadFailed
        error={notebook.error}
        onRetry={() => void notebook.refetch()}
        retrying={notebook.isFetching}
      />
    );
  }
  if (!notebook.isPending && !notebook.data) return <NotebookNotFound />;

  // While the notebook loads, the layout already stands and each column shows its own placeholder.
  const id = notebook.data?.id ?? notebookId;
  // Only the wide layout has rails; below it every column is shown whole.
  const sourcesFolded = wide && !layout.sourcesOpen;
  const studioFolded = wide && !layout.studioOpen;

  return (
    <>
      <AppHeader
        title={
          notebook.data ? (
            <NotebookTitle key={notebook.data.title} notebook={notebook.data} />
          ) : (
            <Skeleton className="h-7 w-64 max-w-[40vw]" aria-hidden />
          )
        }
        actions={
          notebook.data ? (
            <NotebookActions notebook={notebook.data} onCustomize={customize} />
          ) : undefined
        }
      />
      <ColumnTabs column={layout.column} onSelect={layout.setColumn} />
      <div className="flex min-h-0 flex-1 px-4 wide:mx-3 wide:gap-2 wide:px-0">
        <SourcesColumn
          notebookId={id}
          shown={layout.column}
          folded={sourcesFolded}
          reading={layout.reading}
          onToggle={layout.toggleSources}
          onOpenSource={layout.openSource}
          onCloseReader={layout.closeReader}
        />
        <ChatColumn
          notebookId={id}
          shown={layout.column}
          sourcesFolded={sourcesFolded}
          studioFolded={studioFolded}
          asked={layout.asked}
          onOpenCitation={layout.openCitation}
          onCustomize={customize}
        />
        <StudioColumn
          notebookId={id}
          shown={layout.column}
          folded={studioFolded}
          viewing={layout.viewingOutput}
          onToggle={layout.toggleStudio}
          onExpand={layout.expandStudio}
          onOpenCitation={layout.openCitation}
          onAsk={layout.askInChat}
          onViewingChange={layout.setViewingOutput}
        />
      </div>
      {notebook.data && (
        <CustomizeNotebookDialog
          notebook={notebook.data}
          open={customizing}
          onOpenChange={setCustomizing}
        />
      )}
    </>
  );
}
