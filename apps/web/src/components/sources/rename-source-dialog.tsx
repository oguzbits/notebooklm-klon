import { type FormEvent, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRenameSource } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

/** "Quelle umbenennen": one field with the title, saved with the button or the Enter key. */
export function RenameSourceDialog({
  notebookId,
  sourceId,
  title,
  open,
  onOpenChange,
}: {
  notebookId: string;
  sourceId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {open && (
          <RenameForm
            notebookId={notebookId}
            sourceId={sourceId}
            title={title}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  notebookId,
  sourceId,
  title,
  onDone,
}: {
  notebookId: string;
  sourceId: string;
  title: string;
  onDone: () => void;
}) {
  const rename = useRenameSource(notebookId);
  const [value, setValue] = useState(title);
  const clean = value.trim();

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (clean === '' || rename.isPending) return;
    if (clean === title) return onDone();
    rename.mutate({ sourceId, title: clean }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Quelle umbenennen</DialogTitle>
        <DialogDescription className="sr-only">Gib der Quelle einen neuen Namen.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="source-title-field">Name der Quelle</Label>
        <Input
          id="source-title-field"
          value={value}
          maxLength={200}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      {rename.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(rename.error)}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="submit" disabled={clean === '' || rename.isPending}>
          Speichern
        </Button>
      </DialogFooter>
    </form>
  );
}
