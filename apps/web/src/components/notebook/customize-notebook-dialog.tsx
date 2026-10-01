import type { Notebook } from '@nlm/shared';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';

/**
 * "Notebook anpassen" of the original: the title of the notebook and a summary of your own that is
 * shown instead of the one made from the sources. Only what changed is sent. The form starts from the
 * notebook each time the dialog opens, so a change that was not saved is gone.
 */
export function CustomizeNotebookDialog({
  notebook,
  open,
  onOpenChange,
}: {
  notebook: Notebook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        {open && <CustomizeForm notebook={notebook} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CustomizeForm({ notebook, onDone }: { notebook: Notebook; onDone: () => void }) {
  const update = useUpdateNotebook(notebook.id);
  const [title, setTitle] = useState(notebook.title);
  const [writing, setWriting] = useState(notebook.customSummary !== null);
  const [summary, setSummary] = useState(notebook.customSummary ?? '');

  const cleanTitle = title.trim();
  const cleanSummary = writing ? summary.trim() : null;
  const titleChanged = cleanTitle !== notebook.title;
  const summaryChanged = cleanSummary !== notebook.customSummary;
  const valid = cleanTitle !== '' && (!writing || cleanSummary !== '');

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    if (!titleChanged && !summaryChanged) return onDone();
    update.mutate(
      {
        ...(titleChanged && { title: cleanTitle }),
        ...(summaryChanged && { customSummary: cleanSummary }),
      },
      { onSuccess: onDone }
    );
  };

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="pr-12 break-words">„{notebook.title}“ anpassen</DialogTitle>
        <DialogDescription className="sr-only">
          Ändere den Titel und lege eine eigene Zusammenfassung fest.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="notebook-title-field">Titel des Notizbuchs</Label>
        <Input
          id="notebook-title-field"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="own-summary-switch" className="text-ui font-title">
            Eigene Zusammenfassung festlegen
          </Label>
          <Switch id="own-summary-switch" checked={writing} onCheckedChange={setWriting} />
        </div>
        <p className="text-ui text-muted-foreground">
          Standardmäßig fasst das Notizbuch deine Quellen selbst zusammen. Mit einer eigenen
          Zusammenfassung ersetzt du diesen Text.
        </p>
        {writing && (
          <Textarea
            aria-label="Eigene Zusammenfassung"
            value={summary}
            maxLength={3000}
            rows={5}
            placeholder="Worum geht es in diesem Notizbuch?"
            onChange={(event) => setSummary(event.target.value)}
          />
        )}
      </div>

      {update.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(update.error)}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!valid || update.isPending}>
          Fertig
        </Button>
      </DialogFooter>
    </form>
  );
}
