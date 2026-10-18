import { ArrowLeft } from 'lucide-react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { tr } from '@/lib/i18n';

const PASTED_TEXT_TITLE = tr('Eingefügter Text', 'Pasted text');
const TEXT_FILE_EXTENSION = '.txt';

/** The title of a view of the dialog with the way back to the choice. */
function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon-lg" aria-label={tr('Zurück', 'Back')} onClick={onBack}>
        <ArrowLeft />
      </Button>
      <h3 className="text-[1.375rem] leading-9">{title}</h3>
    </div>
  );
}

/** What a form hands over: the value, and a way to empty the form once it was accepted. */
type Submit<T> = (value: T, reset: () => void) => void;

interface WebPageFormProps {
  pending: boolean;
  onSubmit: Submit<string>;
  onBack: () => void;
}

/** The address of a web page to add as a source. */
export function WebPageForm({ pending, onSubmit, onBack }: WebPageFormProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const url = String(new FormData(form).get('url') ?? '').trim();
    if (url) onSubmit(url, () => form.reset());
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <BackHeader title={tr('Webseite hinzufügen', 'Add web page')} onBack={onBack} />
      <p className="text-read text-muted-foreground">
        {tr(
          'Füge die Adresse einer Webseite, eines PDFs oder eines öffentlichen YouTube-Videos ein. Bei einer Webseite wird der sichtbare Text importiert, bei einem Video das gesprochene Wort.',
          'Paste the address of a web page, a PDF or a public YouTube video. For a web page the visible text is imported, for a video the spoken words.'
        )}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-url">{tr('Webadresse', 'Web address')}</Label>
        <Input id="source-url" name="url" type="url" placeholder="https://…" required />
      </div>
      <Button
        type="submit"
        variant="secondary"
        size="lg"
        className="self-end"
        disabled={pending}
        aria-label={tr('Link hinzufügen', 'Add link')}
      >
        {pending ? tr('Lädt …', 'Loading …') : tr('Einfügen', 'Insert')}
      </Button>
    </form>
  );
}

interface PastedTextFormProps {
  pending: boolean;
  /** The text as a file, named after the title the reader gave it. */
  onSubmit: Submit<File>;
  onBack: () => void;
}

/** A text the reader pasted, with an optional title, to add as a source. */
export function PastedTextForm({ pending, onSubmit, onBack }: PastedTextFormProps) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = String(data.get('text') ?? '').trim();
    const title = String(data.get('title') ?? '').trim() || PASTED_TEXT_TITLE;
    if (text) {
      onSubmit(new File([text], `${title}${TEXT_FILE_EXTENSION}`, { type: 'text/plain' }), () =>
        form.reset()
      );
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <BackHeader title={tr('Kopierten Text einfügen', 'Insert pasted text')} onBack={onBack} />
      <Input
        name="title"
        aria-label={tr('Titel des Textes', 'Title of the text')}
        placeholder={tr('Titel (optional)', 'Title (optional)')}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="source-text">{tr('Kopierter Text', 'Pasted text')}</Label>
        <Textarea
          id="source-text"
          name="text"
          placeholder={tr('Text hier einfügen …', 'Paste text here …')}
          rows={8}
          required
        />
      </div>
      <Button
        type="submit"
        variant="secondary"
        size="lg"
        className="self-end"
        disabled={pending}
        aria-label={tr('Text hinzufügen', 'Add text')}
      >
        {tr('Einfügen', 'Insert')}
      </Button>
    </form>
  );
}
