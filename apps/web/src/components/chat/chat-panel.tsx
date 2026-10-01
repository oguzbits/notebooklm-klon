import { SOURCE_STATUS } from '@nlm/shared';
import { memo, useEffect, useRef } from 'react';

import { Conversation } from '@/components/chat/conversation';
import { JumpToEndButton } from '@/components/chat/jump-to-end-button';
import { NotebookOverview } from '@/components/chat/notebook-overview';
import { QuestionForm } from '@/components/chat/question-form';
import { ErrorNotice } from '@/components/query-boundary';
import { useAskQuestion, useChatHistory } from '@/hooks/use-chat';
import { type IncomingQuestion, useIncomingQuestion } from '@/hooks/use-incoming-question';
import { useSuggestedQuestions } from '@/hooks/use-overview';
import { useScrollEnd } from '@/hooks/use-scroll-end';
import { useSources } from '@/hooks/use-sources';

const NO_SOURCE_HINT =
  'Wähle links mindestens eine fertig gelesene Quelle aus, um Fragen zu stellen.';

/** The middle panel: the conversation, the field for a new question and the streamed answer. */
export const ChatPanel = memo(function ChatPanel({
  notebookId,
  onOpenCitation,
  onCustomize,
  incoming = null,
}: {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
  /** The cover of the notebook was clicked: open the dialog to customize it. */
  onCustomize: () => void;
  /** A question from elsewhere on the page, asked once when it is new (its ID counts up). */
  incoming?: IncomingQuestion | null;
}) {
  const history = useChatHistory(notebookId);
  const sources = useSources(notebookId);
  const ask = useAskQuestion(notebookId);
  const suggestions = useSuggestedQuestions(notebookId, sources.data ?? []);
  const { scroller, atEnd, trackEnd, jumpToEnd } = useScrollEnd();
  const bottom = useRef<HTMLDivElement>(null);

  const list = sources.data ?? [];
  const usable = list.filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  // With a source that is read, the overview of the notebook leads the chat.
  const hasReady = list.some((source) => source.status === SOURCE_STATUS.READY);
  const canAsk = usable > 0 && !ask.isPending;

  const liveCount = ask.live?.statements.length ?? 0;
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: 'end' });
  }, [history.data?.length, liveCount, ask.isPending]);
  useIncomingQuestion(incoming, canAsk, ask.mutate);

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
            <NotebookOverview
              notebookId={notebookId}
              sources={sources.data}
              onCustomize={onCustomize}
            />
            <Conversation
              history={history}
              ask={ask}
              hasReady={hasReady}
              suggestions={suggestions}
              canAsk={canAsk}
              citations={{ notebookId, onOpenCitation }}
            />
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
        {!atEnd && <JumpToEndButton onClick={jumpToEnd} />}
      </div>
      <QuestionForm
        usable={usable}
        canAsk={canAsk}
        pending={ask.isPending}
        hint={sources.isSuccess && usable === 0 ? NO_SOURCE_HINT : null}
        onAsk={ask.mutate}
      />
    </div>
  );
});
