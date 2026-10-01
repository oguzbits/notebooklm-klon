import { CHAT_ROLE, SOURCE_STATUS } from '@nlm/shared';
import { ArrowDown, ArrowUp, FileText, LoaderCircle, MessageCircleQuestion } from 'lucide-react';
import {
  type FormEvent,
  Fragment,
  type KeyboardEvent,
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';

import { FollowUps } from '@/components/chat/follow-ups';
import {
  AnswerView,
  DayDivider,
  MessageView,
  QuestionBubble,
} from '@/components/chat/message-view';
import { NotebookOverview } from '@/components/chat/notebook-overview';
import { ErrorNotice, QueryBoundary } from '@/components/query-boundary';
import { ChatSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAskQuestion, useChatHistory } from '@/hooks/use-chat';
import { type Suggestions, useSuggestedQuestions } from '@/hooks/use-overview';
import { useSources } from '@/hooks/use-sources';
import { isSameDay } from '@/lib/day';

/** How far from the end (in px) the chat may be and still count as being at its end. */
const END_TOLERANCE = 48;

/** Whether a message at this time opens a new day of the conversation. */
const startsDay = (previous: { createdAt: string } | undefined, createdAt: string) =>
  previous === undefined || !isSameDay(previous.createdAt, createdAt);

/** The questions to start with: while they are made, when that failed, and as buttons. */
function SuggestionList({
  suggestions,
  canAsk,
  onAsk,
}: {
  suggestions: Suggestions;
  canAsk: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <>
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
                onClick={() => onAsk(suggestion)}
              >
                {suggestion}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** The middle panel: the conversation, the field for a new question and the streamed answer. */
export const ChatPanel = memo(function ChatPanel({
  notebookId,
  onOpenCitation,
  incoming = null,
}: {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
  /** A question from elsewhere on the page, asked once when it is new (its ID counts up). */
  incoming?: { id: number; question: string } | null;
}) {
  const history = useChatHistory(notebookId);
  const sources = useSources(notebookId);
  const ask = useAskQuestion(notebookId);
  const suggestions = useSuggestedQuestions(notebookId, sources.data ?? []);
  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [question, setQuestion] = useState('');
  const handled = useRef(0);

  const usable = (sources.data ?? []).filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  // With a source that is read, the overview of the notebook leads the chat.
  const hasReady = (sources.data ?? []).some((source) => source.status === SOURCE_STATUS.READY);
  const canAsk = usable > 0 && !ask.isPending;
  const canSend = canAsk && question.trim() !== '';

  // Only the last answer of the conversation suggests what to ask next, and only while it is the last.
  const lastMessage = history.data?.at(-1);
  const lastFollowUps = lastMessage?.role === CHAT_ROLE.ASSISTANT ? lastMessage.followUps : [];

  const liveCount = ask.live?.statements.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [history.data?.length, liveCount, ask.isPending]);

  // A question sent from elsewhere is asked like a typed one. While an answer is being written, or
  // with no source to answer from, it is not asked: the same rule as for the field.
  useEffect(() => {
    if (!incoming || incoming.id === handled.current) return;
    handled.current = incoming.id;
    if (canAsk) ask.mutate(incoming.question);
  }, [incoming, canAsk, ask]);

  const trackEnd = () => {
    const area = scroller.current;
    if (!area) return;
    setAtEnd(area.scrollHeight - area.scrollTop - area.clientHeight <= END_TOLERANCE);
  };

  const jumpToEnd = () => {
    const area = scroller.current;
    area?.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
  };

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
      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          data-testid="chat-scroll"
          onScroll={trackEnd}
          className="h-full overflow-y-auto px-5 pb-5"
        >
          <div className="mx-auto flex max-w-[756px] flex-col gap-3 px-6 pt-2">
            <NotebookOverview notebookId={notebookId} sources={sources.data} />
            <QueryBoundary
              query={history}
              // The overview has placeholders of its own while it loads, a second set would double them.
              loading={hasReady ? null : <ChatSkeleton />}
              isEmpty={(messages) => messages.length === 0 && !ask.live}
              empty={
                hasReady ? (
                  <div className="flex flex-col items-center gap-2 py-2 text-center">
                    <p className="max-w-sm text-ui text-muted-foreground">
                      Jede Aussage einer Antwort hat eine Nummer, die zur Textstelle führt.
                    </p>
                    <SuggestionList
                      suggestions={suggestions}
                      canAsk={canAsk}
                      onAsk={(text) => ask.mutate(text)}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <MessageCircleQuestion className="size-12 text-muted-foreground" aria-hidden />
                    <p className="text-xl font-title">Stelle deine erste Frage</p>
                    <p className="max-w-sm text-read text-muted-foreground">
                      Die Antwort stützt sich nur auf deine ausgewählten Quellen. Jede Aussage hat
                      eine Nummer, die zur Textstelle führt.
                    </p>
                    <SuggestionList
                      suggestions={suggestions}
                      canAsk={canAsk}
                      onAsk={(text) => ask.mutate(text)}
                    />
                  </div>
                )
              }
            >
              {(messages) => (
                <>
                  {messages.map((message, index) => (
                    <Fragment key={message.id}>
                      {startsDay(messages[index - 1], message.createdAt) && (
                        <DayDivider iso={message.createdAt} />
                      )}
                      <MessageView
                        message={message}
                        notebookId={notebookId}
                        onOpenCitation={onOpenCitation}
                      />
                    </Fragment>
                  ))}
                  {lastFollowUps.length > 0 && !ask.live && (
                    <div className="pr-8">
                      <FollowUps
                        questions={lastFollowUps}
                        disabled={!canAsk}
                        onAsk={(suggestion) => ask.mutate(suggestion)}
                      />
                    </div>
                  )}
                  {ask.live && (
                    <>
                      {startsDay(lastMessage, ask.live.askedAt) && (
                        <DayDivider iso={ask.live.askedAt} />
                      )}
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
        {!atEnd && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            tooltip="Nach unten springen"
            aria-label="Nach unten springen"
            onClick={jumpToEnd}
            className="absolute bottom-3 left-1/2 size-9 -translate-x-1/2 rounded-full bg-card shadow-glow"
          >
            <ArrowDown />
          </Button>
        )}
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
});
