import { type Notebook, NOTEBOOK_TITLE_MAX_CHARS } from '@nlm/shared';
import { type FormEvent, type ReactNode, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';

/** The dialog behind a button that makes a notebook: it asks for the title, then calls `onCreated`. */
export function CreateNotebookDialog({
  trigger,
  onCreated,
}: {
  trigger: ReactNode;
  onCreated?: (notebook: Notebook) => void;
}) {
  const create = useCreateNotebook();
  const [open, setOpen] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (title) {
      create.mutate(title, {
        onSuccess: (notebook) => {
          form.reset();
          setOpen(false);
          onCreated?.(notebook);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Notizbuch</DialogTitle>
          <DialogDescription>
            Ein Notizbuch sammelt Quellen zu einem Thema. Fragen werden nur aus diesen Quellen
            beantwortet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="notebook-title">Titel des Notizbuchs</Label>
            <Input
              id="notebook-title"
              name="title"
              placeholder="Zum Beispiel: Steuerrecht"
              maxLength={NOTEBOOK_TITLE_MAX_CHARS}
              required
            />
          </div>
          {create.isError && (
            <Alert variant="destructive">
              <AlertDescription>{describeError(create.error)}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="self-end" disabled={create.isPending}>
            {create.isPending ? 'Wird angelegt …' : 'Anlegen'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
