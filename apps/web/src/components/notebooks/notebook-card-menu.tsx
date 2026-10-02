import type { Notebook } from '@nlm/shared';
import { EllipsisVertical, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RenameDialog } from '@/components/ui/rename-dialog';
import { useUpdateNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';

/**
 * The menu on a card of the start page, like the original: change the title, pin the notebook to
 * the top, delete it. A pin that could not be set is reported to the page.
 */
export function NotebookCardMenu({
  notebook,
  onDelete,
  onError,
}: {
  notebook: Notebook;
  onDelete: () => void;
  onError: (error: unknown) => void;
}) {
  const update = useUpdateNotebook(notebook.id);
  const [renaming, setRenaming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-6 right-6"
            aria-label={`Weitere Aktionen für Notebook „${notebook.title}“`}
            tooltip="Mehr"
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil aria-hidden />
            Titel bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => update.mutate({ pinned: !notebook.pinned }, { onError })}
          >
            {notebook.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
            {notebook.pinned ? 'Nicht mehr oben anpinnen' : 'Oben anpinnen'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDelete}>
            <Trash2 aria-hidden />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog
        heading="Titel bearbeiten"
        label="Titel des Notebooks"
        value={notebook.title}
        open={renaming}
        onOpenChange={setRenaming}
        pending={update.isPending}
        error={update.isError ? describeError(update.error) : null}
        onSave={(title, close) => update.mutate({ title }, { onSuccess: close })}
      />
    </>
  );
}
