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
            aria-label="Quelle hinzufügen"
            tooltip="Quelle hinzufügen"
          >
            <Plus />
          </Button>
        ) : (
          <Button variant="secondary" className="w-full" tooltip="Quelle hinzufügen">
            <Plus />
            Quellen hinzufügen
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
          <DialogTitle>Quellen hinzufügen</DialogTitle>
          <DialogDescription>
            Fragen werden nur aus den Quellen beantwortet, die du hier hinzufügst.
          </DialogDescription>
        </DialogHeader>
        <AddSource notebookId={notebookId} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
