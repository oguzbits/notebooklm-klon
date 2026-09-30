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

/** The button on top of the sources and the dialog behind it, where sources are added. */
export function AddSourceDialog({ notebookId }: { notebookId: string }) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full" tooltip="Quelle hinzufügen">
          <Plus />
          Quellen hinzufügen
        </Button>
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
