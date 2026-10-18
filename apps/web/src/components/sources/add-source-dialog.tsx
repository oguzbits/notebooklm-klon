import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';

import { AddSource } from '@/components/sources/add-source';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { tr } from '@/lib/i18n';

/**
 * The button on top of the sources and the dialog behind it, where sources are added. `compact` is
 * the round plus of the folded column.
 */
export function AddSourceDialog({
  notebookId,
  compact = false,
}: {
  notebookId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tr('Quelle hinzufügen', 'Add source')}
            tooltip={tr('Quelle hinzufügen', 'Add source')}
          >
            <Plus />
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="w-full"
            tooltip={tr('Quelle hinzufügen', 'Add source')}
          >
            <Plus />
            {tr('Quellen hinzufügen', 'Add sources')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        ref={content}
        className="sm:max-w-[700px]"
        // The dialog itself takes the focus, so no chip shows a ring before anything was done.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus();
        }}
      >
        <DialogHeader className="items-center text-center sm:px-10">
          <DialogTitle>{tr('Quellen hinzufügen', 'Add sources')}</DialogTitle>
          <DialogDescription>
            {tr(
              'Fragen werden nur aus den Quellen beantwortet, die du hier hinzufügst.',
              'Answers come only from the sources you add here.'
            )}
          </DialogDescription>
        </DialogHeader>
        <AddSource notebookId={notebookId} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
