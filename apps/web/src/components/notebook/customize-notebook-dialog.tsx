import {
  COVER_IMAGE,
  MAX_SUMMARY_CHARS,
  type Notebook,
  NOTEBOOK_TITLE_MAX_CHARS,
} from '@nlm/shared';
import { ImageIcon, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useRef } from 'react';

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
import { useNotebookDraft } from '@/hooks/use-notebook-draft';
import { coverUrl, useRemoveCover, useUpdateNotebook, useUploadCover } from '@/hooks/use-notebooks';
import { useCapabilities } from '@/hooks/use-web-search';
import { describeError } from '@/lib/messages';

interface CustomizeNotebookDialogProps {
  notebook: Notebook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Notebook anpassen" of the original: the title of the notebook and a summary of your own that is
 * shown instead of the one made from the sources. Only what changed is sent. The form starts from the
 * notebook each time the dialog opens, so a change that was not saved is gone.
 */
export function CustomizeNotebookDialog({
  notebook,
  open,
  onOpenChange,
}: CustomizeNotebookDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        {open && <CustomizeForm notebook={notebook} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

interface CoverPreviewProps {
  notebook: Notebook;
  busy: boolean;
  uploading: boolean;
  onPick: () => void;
  onRemove: () => void;
}

/** The picture (or a placeholder) with the buttons on it: choose a file, take the picture back. */
function CoverPreview({ notebook, busy, uploading, onPick, onRemove }: CoverPreviewProps) {
  return (
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
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        )}
        <Button type="button" variant="secondary" disabled={busy} onClick={onPick}>
          <Upload />
          {uploading ? 'Wird hochgeladen …' : 'Hochladen'}
        </Button>
      </div>
    </div>
  );
}

interface CoverPickerProps {
  notebook: Notebook;
}

/** The cover image of the notebook: the preview, a hidden file field behind its button, and the failure. */
function CoverPicker({ notebook }: CoverPickerProps) {
  const upload = useUploadCover(notebook.id);
  const remove = useRemoveCover(notebook.id);
  const input = useRef<HTMLInputElement>(null);
  const failed = upload.error ?? remove.error;

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be chosen again later.
    event.target.value = '';
    if (file) upload.mutate(file);
  };

  return (
    <div className="grid gap-2">
      <CoverPreview
        notebook={notebook}
        busy={upload.isPending || remove.isPending}
        uploading={upload.isPending}
        onPick={() => input.current?.click()}
        onRemove={() => remove.mutate()}
      />
      <input
        ref={input}
        type="file"
        className="hidden"
        accept={COVER_IMAGE.TYPES.join(',')}
        aria-label="Titelbild auswählen"
        onChange={choose}
      />
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(failed)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface SummaryFieldProps {
  writing: boolean;
  summary: string;
  onWriting: (writing: boolean) => void;
  onSummary: (summary: string) => void;
}

/** The switch for a summary of your own, and the text it opens. */
function SummaryField({ writing, summary, onWriting, onSummary }: SummaryFieldProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="own-summary-switch" className="text-ui font-title">
          Eigene Zusammenfassung festlegen
        </Label>
        <Switch id="own-summary-switch" checked={writing} onCheckedChange={onWriting} />
      </div>
      <p className="text-ui text-muted-foreground">
        Standardmäßig fasst das Notebook deine Quellen selbst zusammen. Mit einer eigenen
        Zusammenfassung ersetzt du diesen Text.
      </p>
      {writing && (
        <Textarea
          aria-label="Eigene Zusammenfassung"
          value={summary}
          maxLength={MAX_SUMMARY_CHARS}
          rows={5}
          placeholder="Worum geht es in diesem Notebook?"
          onChange={(event) => onSummary(event.target.value)}
        />
      )}
    </div>
  );
}

interface CustomizeFormProps {
  notebook: Notebook;
  onDone: () => void;
}

function CustomizeForm({ notebook, onDone }: CustomizeFormProps) {
  const update = useUpdateNotebook(notebook.id);
  const capabilities = useCapabilities();
  const draft = useNotebookDraft(notebook);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.valid) return;
    if (!draft.changes) return onDone();
    update.mutate(draft.changes, { onSuccess: onDone });
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
        <Label htmlFor="notebook-title-field">Titel des Notebooks</Label>
        <Input
          id="notebook-title-field"
          value={draft.title}
          maxLength={NOTEBOOK_TITLE_MAX_CHARS}
          onChange={(event) => draft.setTitle(event.target.value)}
        />
      </div>
      <SummaryField
        writing={draft.writing}
        summary={draft.summary}
        onWriting={draft.setWriting}
        onSummary={draft.setSummary}
      />
      {update.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(update.error)}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="submit" disabled={!draft.valid || update.isPending}>
          Fertig
        </Button>
      </DialogFooter>
    </form>
  );
}
