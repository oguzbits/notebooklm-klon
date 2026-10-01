import { ArrowLeft, ClipboardPaste, Link2, Upload } from 'lucide-react';
import { type DragEvent, type FormEvent, useRef, useState } from 'react';

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

const VIEW = { CHOOSE: 'CHOOSE', WEB_PAGE: 'WEB_PAGE', TEXT: 'TEXT' } as const;
type View = (typeof VIEW)[keyof typeof VIEW];

interface AddSourceProps {
  notebookId: string;
  /** Called when a source was accepted, so a dialog around this can close. */
  onAdded?: () => void;
}

/**
 * The ways to add a source, as in NotebookLM: pills for a file, a web page or pasted text, and a
 * drop zone. A web page and pasted text open their own view with a way back.
 */
export function AddSource({ notebookId, onAdded }: AddSourceProps) {
  const upload = useUploadFile(notebookId);
  const addUrl = useAddUrl(notebookId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(VIEW.CHOOSE);
  const [dragging, setDragging] = useState(false);

  const sendFile = (file: File | undefined) => {
    if (file) upload.mutate(file, { onSuccess: () => onAdded?.() });
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    sendFile(event.dataTransfer.files[0]);
  };

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
    <div className="flex flex-col gap-5">
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        aria-label="Datei auswählen"
        onChange={(event) => {
          sendFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {view === VIEW.CHOOSE && (
        <>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="text-[1.0625rem]"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <Upload />
              {upload.isPending ? 'Wird hochgeladen …' : 'Datei hochladen'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-[1.0625rem]"
              onClick={() => setView(VIEW.WEB_PAGE)}
            >
              <Link2 />
              Webseite
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-[1.0625rem]"
              onClick={() => setView(VIEW.TEXT)}
            >
              <ClipboardPaste />
              Kopierter Text
            </Button>
          </div>
          <div
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-input px-6 py-10 text-center text-small text-muted-foreground ${dragging ? 'bg-accent' : ''}`}
          >
            <Upload className="size-6" aria-hidden />
            <p>
              Dateien zum Hochladen per Drag-and-drop hierher ziehen.
              <br />
              PDF, DOCX, TXT oder MD, bis 10 MB.
            </p>
          </div>
        </>
      )}

      {view === VIEW.WEB_PAGE && (
        <form onSubmit={submitUrl} className="flex flex-col gap-4">
          <BackHeader title="Webseite hinzufügen" onBack={() => setView(VIEW.CHOOSE)} />
          <p className="text-read text-muted-foreground">
            Füge die Adresse einer Webseite ein. Es wird der sichtbare Text importiert.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="source-url">Webadresse</Label>
            <Input id="source-url" name="url" type="url" placeholder="https://…" required />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="self-end"
            disabled={addUrl.isPending}
            aria-label="Link hinzufügen"
          >
            {addUrl.isPending ? 'Lädt …' : 'Einfügen'}
          </Button>
        </form>
      )}

      {view === VIEW.TEXT && (
        <form onSubmit={submitText} className="flex flex-col gap-4">
          <BackHeader title="Kopierten Text einfügen" onBack={() => setView(VIEW.CHOOSE)} />
          <Input name="title" aria-label="Titel des Textes" placeholder="Titel (optional)" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="source-text">Kopierter Text</Label>
            <Textarea
              id="source-text"
              name="text"
              placeholder="Text hier einfügen …"
              rows={8}
              required
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            className="self-end"
            disabled={upload.isPending}
            aria-label="Text hinzufügen"
          >
            Einfügen
          </Button>
        </form>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(error)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface BackHeaderProps {
  title: string;
  onBack: () => void;
}

function BackHeader({ title, onBack }: BackHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon-lg" aria-label="Zurück" onClick={onBack}>
        <ArrowLeft />
      </Button>
      <h3 className="text-[1.375rem] leading-9">{title}</h3>
    </div>
  );
}
