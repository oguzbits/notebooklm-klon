import { ClipboardPaste, FileUp, Link2 } from 'lucide-react';
import { type FormEvent, useRef } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAddUrl, useUploadFile } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

const ACCEPTED_FILES = '.pdf,.docx,.txt,.md';
const PASTED_TEXT_TITLE = 'Eingefügter Text';
const TEXT_FILE_EXTENSION = '.txt';

/** The three ways to add a source: a file from the computer, a web page, or pasted text. */
export function AddSource({
  notebookId,
  onAdded,
}: {
  notebookId: string;
  /** Called when a source was accepted, so a dialog around this can close. */
  onAdded?: () => void;
}) {
  const upload = useUploadFile(notebookId);
  const addUrl = useAddUrl(notebookId);
  const fileInput = useRef<HTMLInputElement>(null);

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const url = String(new FormData(form).get('url') ?? '').trim();
    if (url) {
      addUrl.mutate(url, {
        onSuccess: () => {
          form.reset();
          onAdded?.();
        },
      });
    }
  };

  const submitText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = String(data.get('text') ?? '').trim();
    const title = String(data.get('title') ?? '').trim() || PASTED_TEXT_TITLE;
    if (text) {
      upload.mutate(new File([text], `${title}${TEXT_FILE_EXTENSION}`, { type: 'text/plain' }), {
        onSuccess: () => {
          form.reset();
          onAdded?.();
        },
      });
    }
  };

  const error = upload.error ?? addUrl.error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_FILES}
          className="hidden"
          aria-label="Datei auswählen"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file, { onSuccess: () => onAdded?.() });
            event.target.value = '';
          }}
        />
        <Button
          variant="outline"
          className="h-auto w-full flex-col gap-2 rounded-3xl border-dashed py-8"
          disabled={upload.isPending}
          onClick={() => fileInput.current?.click()}
        >
          <FileUp className="size-6" />
          {upload.isPending ? 'Wird hochgeladen …' : 'Datei hochladen'}
        </Button>
        <p className="px-2 text-xs text-muted-foreground">PDF, DOCX, TXT oder MD, bis 10 MB.</p>
      </div>

      <form onSubmit={submitUrl} className="flex flex-col gap-2">
        <Label htmlFor="source-url">Oder eine Webseite</Label>
        <div className="flex gap-2">
          <Input id="source-url" name="url" type="url" placeholder="https://…" required />
          <Button
            type="submit"
            variant="secondary"
            disabled={addUrl.isPending}
            aria-label="Link hinzufügen"
          >
            <Link2 />
            {addUrl.isPending ? 'Lädt …' : 'Hinzufügen'}
          </Button>
        </div>
      </form>

      <form onSubmit={submitText} className="flex flex-col gap-2">
        <Label htmlFor="source-text">Oder kopierter Text</Label>
        <Input name="title" aria-label="Titel des Textes" placeholder="Titel (optional)" />
        <Textarea
          id="source-text"
          name="text"
          placeholder="Text hier einfügen …"
          rows={4}
          required
        />
        <Button type="submit" variant="secondary" className="self-end" disabled={upload.isPending}>
          <ClipboardPaste />
          Text hinzufügen
        </Button>
      </form>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(error)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
