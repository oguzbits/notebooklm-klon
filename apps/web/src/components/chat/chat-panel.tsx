import { SOURCE_STATUS } from '@nlm/shared';
import { LoaderCircle, MessageCircleQuestion, SendHorizontal } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef } from 'react';

import { AnswerView, MessageView, QuestionBubble } from '@/components/chat/message-view';
import { ErrorNotice, QueryBoundary } from '@/components/query-boundary';
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

  const usable = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  const canAsk = usable > 0 && !ask.isPending;

  const liveCount = ask.live?.statements.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [history.data?.length, liveCount, ask.isPending]);

  const send = (form: HTMLFormElement) => {
    const question = String(new FormData(form).get('question') ?? '').trim();
    if (!question || !canAsk) return;
    ask.mutate(question);
    form.reset();
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <QueryBoundary
            query={history}
            isEmpty={(messages) => messages.length === 0 && !ask.live}
            empty={
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <MessageCircleQuestion className="size-10 text-muted-foreground" aria-hidden />
                <p className="font-medium">Stelle deine erste Frage</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Die Antwort stützt sich nur auf deine ausgewählten Quellen. Jede Aussage hat eine
                  Nummer, die zur Textstelle führt.
                </p>
                {suggestions.loading && (
                  <p className="text-sm text-muted-foreground" role="status">
                    Vorschläge werden erstellt …
                  </p>
                )}
                {suggestions.failed && (
                  <p className="text-sm text-muted-foreground">
                    Vorschläge konnten nicht erstellt werden. Du kannst trotzdem fragen.
                  </p>
                )}
                {suggestions.questions.length > 0 && (
                  <ul className="mt-2 flex max-w-xl flex-wrap justify-center gap-2">
                    {suggestions.questions.map((suggestion) => (
                      <li key={suggestion}>
                        <Button
                          variant="outline"
                          size="sm"
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
                    <QuestionBubble text={ask.live.question} />
                    <div className="max-w-[92%]">
                      <AnswerView
                        notebookId={notebookId}
                        statements={ask.live.statements}
                        finished={false}
                        onOpenCitation={onOpenCitation}
                      />
                      <p
                        className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"
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

      <div className="border-t bg-card p-4">
        <form onSubmit={submit} className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-end gap-2">
            <Textarea
              name="question"
              aria-label="Deine Frage"
              placeholder="Stelle eine Frage zu deinen Quellen …"
              rows={2}
              maxLength={2000}
              disabled={ask.isPending}
              onKeyDown={submitOnEnter}
              className="min-h-0 resize-none"
            />
            <Button type="submit" size="icon-lg" aria-label="Frage senden" disabled={!canAsk}>
              <SendHorizontal />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {hint ?? `${usable} ${usable === 1 ? 'Quelle' : 'Quellen'} ausgewählt. `}
            Antworten können Fehler enthalten. Prüfe wichtige Angaben an der Quelle.
          </p>
        </form>
      </div>
    </div>
  );
}
