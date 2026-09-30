import { SOURCE_STATUS } from '@nlm/shared';
import { ArrowUp, FileText, LoaderCircle, MessageCircleQuestion } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { AnswerView, MessageView, QuestionBubble } from '@/components/chat/message-view';
import { ErrorNotice, QueryBoundary } from '@/components/query-boundary';
import { ChatSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAskQuestion, useChatHistory } from '@/hooks/use-chat';
import { useSuggestedQuestions } from '@/hooks/use-overview';
import { useSources } from '@/hooks/use-sources';

/** The middle panel: the conversation, the field for a new question and the streamed answer. */
export function ChatPanel({
  notebookId,
  onOpenCitation,
}: {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
}) {
  const history = useChatHistory(notebookId);
  const sources = useSources(notebookId);
  const ask = useAskQuestion(notebookId);
  const suggestions = useSuggestedQuestions(notebookId, sources.data ?? []);
  const bottom = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState('');

  const usable = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  const canAsk = usable > 0 && !ask.isPending;
  const canSend = canAsk && question.trim() !== '';

  const liveCount = ask.live?.statements.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [history.data?.length, liveCount, ask.isPending]);

  const send = (form: HTMLFormElement) => {
    const text = String(new FormData(form).get('question') ?? '').trim();
    if (!text || !canAsk) return;
    ask.mutate(text);
    setQuestion('');
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send(event.currentTarget);
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const hint =
    sources.isSuccess && usable === 0
      ? 'Wähle links mindestens eine fertig gelesene Quelle aus, um Fragen zu stellen.'
      : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* The text fades out under the top edge instead of being cut off. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-7 bg-gradient-to-b from-background from-0% via-background/98 via-10% to-transparent"
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        <div className="mx-auto flex max-w-[756px] flex-col gap-3 px-6 pt-2">
          <QueryBoundary
            query={history}
            loading={<ChatSkeleton />}
            isEmpty={(messages) => messages.length === 0 && !ask.live}
            empty={
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <MessageCircleQuestion className="size-12 text-muted-foreground" aria-hidden />
                <p className="text-xl font-title">Stelle deine erste Frage</p>
                <p className="max-w-sm text-read text-muted-foreground">
                  Die Antwort stützt sich nur auf deine ausgewählten Quellen. Jede Aussage hat eine
                  Nummer, die zur Textstelle führt.
                </p>
                {suggestions.loading && (
                  <p className="text-ui text-muted-foreground" role="status">
                    Vorschläge werden erstellt …
                  </p>
                )}
                {suggestions.failed && (
                  <p className="text-ui text-muted-foreground">
                    Vorschläge konnten nicht erstellt werden. Du kannst trotzdem fragen.
                  </p>
                )}
                {suggestions.questions.length > 0 && (
                  <ul className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
                    {suggestions.questions.map((suggestion) => (
                      <li key={suggestion}>
                        <Button
                          variant="outline"
                          className="h-auto min-h-9 whitespace-normal py-2 text-left"
                          disabled={!canAsk}
                          onClick={() => ask.mutate(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            }
          >
            {(messages) => (
              <>
                {messages.map((message) => (
                  <MessageView
                    key={message.id}
                    message={message}
                    notebookId={notebookId}
                    onOpenCitation={onOpenCitation}
                  />
                ))}
                {ask.live && (
                  <>
                    <QuestionBubble text={ask.live.question} askedAt={ask.live.askedAt} />
                    <div className="pr-8">
                      <AnswerView
                        notebookId={notebookId}
                        statements={ask.live.statements}
                        finished={false}
                        onOpenCitation={onOpenCitation}
                      />
                      <p
                        className="mt-2 flex items-center gap-2 text-ui text-muted-foreground"
                        role="status"
                      >
                        <LoaderCircle className="size-4 animate-spin" aria-hidden />
                        Antwort wird geschrieben …
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </QueryBoundary>
          {ask.isError && (
            <ErrorNotice
              error={ask.error}
              onRetry={() => ask.variables && ask.mutate(ask.variables)}
              retrying={ask.isPending}
            />
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div>
        <form onSubmit={submit} className="mx-auto flex max-w-[660px] flex-col px-4">
          <div className="flex min-h-16 items-center gap-2 rounded-panel bg-card py-3 pr-3 pl-5 shadow-glow">
            <Textarea
              name="question"
              aria-label="Deine Frage"
              placeholder="Stelle eine Frage zu deinen Quellen …"
              rows={1}
              maxLength={2000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={ask.isPending}
              onKeyDown={submitOnEnter}
              className="text-read max-h-40 min-h-0 flex-1 resize-none self-center rounded-none border-0 bg-transparent px-0 py-0.5 shadow-none focus-visible:border-0 focus-visible:outline-0"
            />
            <span className="hidden shrink-0 text-small text-muted-foreground sm:inline">
              {usable} {usable === 1 ? 'Quelle' : 'Quellen'}
            </span>
            <span
              className="flex shrink-0 items-center gap-1 text-small text-muted-foreground sm:hidden"
              aria-hidden
            >
              <FileText className="size-5" />({usable})
            </span>
            <Button
              type="submit"
              size="icon"
              variant={canSend ? 'default' : 'secondary'}
              aria-label="Frage senden"
              disabled={!canSend}
            >
              <ArrowUp />
            </Button>
          </div>
          <p className="py-3 text-center text-small text-muted-foreground">
            {hint ? `${hint} ` : ''}
            Antworten können Fehler enthalten. Prüfe wichtige Angaben an der Quelle.
          </p>
        </form>
      </div>
    </div>
  );
}
