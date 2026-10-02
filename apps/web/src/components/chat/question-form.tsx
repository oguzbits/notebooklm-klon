import { MAX_QUESTION_CHARS } from '@nlm/shared';
import { ArrowUp, FileText, Square } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** Enter sends, Shift+Enter makes a new line. */
const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
};

/** How many sources the answer will draw on: in words on a wide screen, as a number on a narrow one. */
function SourceCount({ count }: { count: number }) {
  return (
    <>
      <span className="hidden shrink-0 text-small text-muted-foreground sm:inline">
        {count} {count === 1 ? 'Quelle' : 'Quellen'}
      </span>
      <span
        className="flex shrink-0 items-center gap-1 text-small text-muted-foreground sm:hidden"
        aria-hidden
      >
        <FileText className="size-5" />({count})
      </span>
    </>
  );
}

/** Sends the question, and while its answer is written the same place stops the answer. */
function SendOrStop({
  pending,
  canSend,
  onStop,
}: {
  pending: boolean;
  canSend: boolean;
  onStop: () => void;
}) {
  if (pending) {
    return (
      <Button type="button" size="icon" aria-label="Antwort stoppen" onClick={onStop}>
        <Square />
      </Button>
    );
  }
  return (
    <Button
      type="submit"
      size="icon"
      variant={canSend ? 'default' : 'secondary'}
      aria-label="Frage senden"
      disabled={!canSend}
    >
      <ArrowUp />
    </Button>
  );
}

/** The field for a new question with the number of sources, the send button and the note below. */
export function QuestionForm({
  usable,
  canAsk,
  pending,
  hint,
  onAsk,
  onStop,
}: {
  usable: number;
  canAsk: boolean;
  pending: boolean;
  /** Why nothing can be asked yet, or null. */
  hint: string | null;
  onAsk: (question: string) => void;
  /** Ends the answer that is being written. */
  onStop: () => void;
}) {
  const [question, setQuestion] = useState('');
  const canSend = canAsk && question.trim() !== '';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;
    onAsk(question.trim());
    setQuestion('');
  };

  return (
    <div>
      <form onSubmit={submit} className="mx-auto flex max-w-[660px] flex-col px-4">
        <div className="flex min-h-16 items-center gap-2 rounded-panel bg-card py-3 pr-3 pl-5 shadow-glow">
          <Textarea
            name="question"
            aria-label="Deine Frage"
            placeholder="Stelle eine Frage zu deinen Quellen …"
            rows={1}
            maxLength={MAX_QUESTION_CHARS}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={pending}
            onKeyDown={submitOnEnter}
            className="text-read max-h-40 min-h-0 flex-1 resize-none self-center rounded-none border-0 bg-transparent px-0 py-0.5 shadow-none focus-visible:border-0 focus-visible:outline-0"
          />
          <SourceCount count={usable} />
          <SendOrStop pending={pending} canSend={canSend} onStop={onStop} />
        </div>
        <p className="py-3 text-center text-small text-muted-foreground">
          {hint ? `${hint} ` : ''}
          Antworten können Fehler enthalten. Prüfe wichtige Angaben an der Quelle.
        </p>
      </form>
    </div>
  );
}
