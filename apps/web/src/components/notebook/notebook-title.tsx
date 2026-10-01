import type { Notebook } from '@nlm/shared';

import { EditableTitle } from '@/components/ui/editable-title';
import { useUpdateNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';

/**
 * The title of the notebook in the header, at 22/36 like the original, and a field at the same
 * time: click it, type, leave it or press Enter to rename. Escape takes the change back. A title
 * that changed elsewhere is taken over.
 */
export function NotebookTitle({ notebook }: { notebook: Notebook }) {
  const rename = useUpdateNotebook(notebook.id);

  return (
    <div className="flex min-w-0 flex-1 px-2">
      <h1 className="sr-only">{notebook.title}</h1>
      <EditableTitle
        value={notebook.title}
        label="Titel des Notizbuchs"
        saving={rename.isPending}
        error={rename.isError ? describeError(rename.error) : null}
        onSave={(title, revert) => rename.mutate({ title }, { onError: revert })}
        className="h-10 max-w-[590px] px-2 text-[1.375rem] leading-9"
      />
    </div>
  );
}
