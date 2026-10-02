import type { Notebook } from '@nlm/shared';

import { AppHeader } from '@/components/layout/app-header';
import { NotebookActions } from '@/components/notebook/notebook-actions';
import { NotebookTitle } from '@/components/notebook/notebook-title';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks/use-document-title';

/** The header of a notebook page: its title and menu, or a placeholder while it loads. */
export function NotebookHeader({
  notebook,
  onCustomize,
}: {
  notebook: Notebook | undefined;
  onCustomize: () => void;
}) {
  useDocumentTitle(notebook?.title);
  return (
    <AppHeader
      title={
        notebook ? (
          <NotebookTitle key={notebook.title} notebook={notebook} />
        ) : (
          <Skeleton className="h-7 w-64 max-w-[40vw]" aria-hidden />
        )
      }
      actions={
        notebook ? <NotebookActions notebook={notebook} onCustomize={onCustomize} /> : undefined
      }
    />
  );
}
