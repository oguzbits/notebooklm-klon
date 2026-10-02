import { memo } from 'react';

import { Conversation } from '@/components/chat/conversation';
import { JumpToEndButton } from '@/components/chat/jump-to-end-button';
import { NotebookOverview } from '@/components/chat/notebook-overview';
import { QuestionForm } from '@/components/chat/question-form';
import { TopFade } from '@/components/chat/top-fade';
import { useChatSession } from '@/hooks/use-chat-session';
import { useFollowNewest } from '@/hooks/use-follow-newest';
import type { IncomingQuestion } from '@/hooks/use-incoming-question';
import { useScrollEnd } from '@/hooks/use-scroll-end';

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
  const { history, sources, ask, ...chat } = useChatSession(notebookId, incoming);
  const { scroller, atEnd, trackEnd, jumpToEnd } = useScrollEnd();
  const bottom = useFollowNewest({
    messages: history.data?.length,
    statements: ask.live?.statements.length ?? 0,
    pending: ask.isPending,
  });

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <TopFade />
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
              hasReady={chat.hasReady}
              suggestions={chat.suggestions}
              canAsk={chat.canAsk}
              citations={{ notebookId, onOpenCitation }}
            />
            <div ref={bottom} />
          </div>
        </div>
        {!atEnd && <JumpToEndButton onClick={jumpToEnd} />}
      </div>
      <QuestionForm
        usable={chat.usable}
        canAsk={chat.canAsk}
        pending={ask.isPending}
        hint={chat.hint}
        onAsk={ask.mutate}
        onStop={ask.stop}
      />
    </div>
  );
});
