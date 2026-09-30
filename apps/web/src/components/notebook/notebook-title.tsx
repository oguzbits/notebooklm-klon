import type { Notebook } from '@nlm/shared';
import { type KeyboardEvent, useRef, useState } from 'react';

import { useRenameNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';

/**
 * The title of the notebook in the header, at 22/36 like the original, and a field at the same
 * time: click it, type, leave it or press Enter to rename. Escape takes the change back. Mount it
 * with the title as `key`, so a title that changed elsewhere is taken over.
 */
export function NotebookTitle({ notebook }: { notebook: Notebook }) {
  const rename = useRenameNotebook(notebook.id);
  const [value, setValue] = useState(notebook.title);
  // Escape leaves the field too, and that must not save what was typed.
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const title = value.trim();
    if (title === '' || title === notebook.title) {
      setValue(notebook.title);
      return;
    }
    rename.mutate(title, { onError: () => setValue(notebook.title) });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      cancelled.current = true;
      setValue(notebook.title);
      event.currentTarget.blur();
    }
  };

  return (
    <div className="relative min-w-0 flex-1 px-2">
      <h1 className="sr-only">{notebook.title}</h1>
      <input
        aria-label="Titel des Notizbuchs"
        value={value}
        maxLength={200}
        disabled={rename.isPending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="veil h-10 w-full min-w-0 max-w-[590px] truncate rounded-lg bg-transparent px-2 text-[1.375rem] leading-9 outline-none focus-visible:outline-3 focus-visible:outline-ring disabled:opacity-70"
      />
      {rename.isError && (
        <p role="alert" className="absolute top-full left-4 z-10 text-small text-destructive">
          {describeError(rename.error)}
        </p>
      )}
    </div>
  );
}
