import { FileUp, Link2 } from 'lucide-react';
import { type FormEvent, useRef } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAddUrl, useUploadFile } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

const ACCEPTED_FILES = '.pdf,.docx,.txt,.md';

/** The two ways to add a source: a file from the computer or a link to a web page. */
export function AddSource({ notebookId }: { notebookId: string }) {
  const upload = useUploadFile(notebookId);
  const addUrl = useAddUrl(notebookId);
  const fileInput = useRef<HTMLInputElement>(null);

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const url = String(new FormData(form).get('url') ?? '').trim();
    if (url) addUrl.mutate(url, { onSuccess: () => form.reset() });
  };

  const error = upload.error ?? addUrl.error;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_FILES}
        className="hidden"
        aria-label="Datei auswählen"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate(file);
          event.target.value = '';
        }}
      />
      <Button
        variant="outline"
        className="w-full"
        disabled={upload.isPending}
        onClick={() => fileInput.current?.click()}
      >
        <FileUp />
        {upload.isPending ? 'Wird hochgeladen …' : 'Datei hochladen'}
      </Button>
      <p className="-mt-1 text-xs text-muted-foreground">PDF, DOCX, TXT oder MD, bis 10 MB.</p>

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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(error)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
