import { Plus } from 'lucide-react';
import { useState } from 'react';

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
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus />
          Quelle hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
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
