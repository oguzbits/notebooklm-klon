import { useState } from 'react';

import { AddSourceChoice } from '@/components/sources/add-source-choice';
import { PastedTextForm, WebPageForm } from '@/components/sources/add-source-forms';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAddUrl, useUploadFile } from '@/hooks/use-sources';
import { describeError } from '@/lib/messages';

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
  const [view, setView] = useState<View>(VIEW.CHOOSE);
  const choose = () => setView(VIEW.CHOOSE);
  /** After a source was accepted: the form is emptied and the dialog around may close. */
  const accepted = (reset: () => void) => () => {
    reset();
    onAdded?.();
  };
  const error = upload.error ?? addUrl.error;

  return (
    <div className="flex flex-col gap-5">
      {view === VIEW.CHOOSE && (
        <AddSourceChoice
          uploading={upload.isPending}
          onFile={(file) => file && upload.mutate(file, { onSuccess: () => onAdded?.() })}
          onWebPage={() => setView(VIEW.WEB_PAGE)}
          onText={() => setView(VIEW.TEXT)}
        />
      )}
      {view === VIEW.WEB_PAGE && (
        <WebPageForm
          pending={addUrl.isPending}
          onSubmit={(url, reset) => addUrl.mutate(url, { onSuccess: accepted(reset) })}
          onBack={choose}
        />
      )}
      {view === VIEW.TEXT && (
        <PastedTextForm
          pending={upload.isPending}
          onSubmit={(file, reset) => upload.mutate(file, { onSuccess: accepted(reset) })}
          onBack={choose}
        />
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(error)}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
