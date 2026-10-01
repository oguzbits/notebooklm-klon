import { COVER_IMAGE, type Notebook } from '@nlm/shared';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';

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
import { coverUrl, useRemoveCover, useUpdateNotebook, useUploadCover } from '@/hooks/use-notebooks';
import { useCapabilities } from '@/hooks/use-web-search';
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

/** The cover image: the picture (or a placeholder), a button to choose a file and one to take it back. */
function CoverPicker({ notebook }: { notebook: Notebook }) {
  const upload = useUploadCover(notebook.id);
  const remove = useRemoveCover(notebook.id);
  const input = useRef<HTMLInputElement>(null);
  const busy = upload.isPending || remove.isPending;
  const failed = upload.isError ? upload.error : remove.isError ? remove.error : null;

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be chosen again later.
    event.target.value = '';
    if (file) upload.mutate(file);
  };

  return (
    <div className="grid gap-2">
      <div className="relative h-40 overflow-hidden rounded-3xl bg-secondary">
        {notebook.coverVersion ? (
          <img
            src={coverUrl(notebook.id, notebook.coverVersion)}
            alt="Titelbild"
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon
            className="absolute right-6 bottom-4 size-20 text-muted-foreground"
            strokeWidth={1}
            aria-hidden
          />
        )}
        <div className="absolute top-3 right-3 flex gap-2">
          {notebook.coverVersion && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Titelbild entfernen"
              tooltip="Titelbild entfernen"
              disabled={busy}
              onClick={() => remove.mutate()}
            >
              <Trash2 />
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload />
            {upload.isPending ? 'Wird hochgeladen …' : 'Hochladen'}
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept={COVER_IMAGE.TYPES.join(',')}
          aria-label="Titelbild auswählen"
          onChange={choose}
        />
      </div>
      {failed !== null && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(failed)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function CustomizeForm({ notebook, onDone }: { notebook: Notebook; onDone: () => void }) {
  const update = useUpdateNotebook(notebook.id);
  const capabilities = useCapabilities();
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

      {capabilities.data?.coverImage && <CoverPicker notebook={notebook} />}

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
