import { CHAT_ROLE, type ChatMessage } from '@nlm/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { Fragment } from 'react';

import { EmptyChat } from '@/components/chat/empty-chat';
import { FollowUps } from '@/components/chat/follow-ups';
import {
  AnswerView,
  DayDivider,
  MessageView,
  QuestionBubble,
} from '@/components/chat/message-view';
import { QueryBoundary } from '@/components/query-boundary';
import { ChatSkeleton } from '@/components/skeletons';
import type { LiveAnswer, useAskQuestion } from '@/hooks/use-chat';
import type { Suggestions } from '@/hooks/use-overview';
import { isSameDay } from '@/lib/day';

/** Whether a message at this time opens a new day of the conversation. */
const startsDay = (previous: { createdAt: string } | undefined, createdAt: string) =>
  previous === undefined || !isSameDay(previous.createdAt, createdAt);

interface Citations {
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
}

/** The question that is being answered right now, with the answer as far as it has come. */
function LiveTurn({
  live,
  previous,
  citations,
}: {
  live: LiveAnswer;
  previous: ChatMessage | undefined;
  citations: Citations;
}) {
  return (
    <>
      {startsDay(previous, live.askedAt) && <DayDivider iso={live.askedAt} />}
      <QuestionBubble text={live.question} askedAt={live.askedAt} />
      <div className="pr-8">
        <AnswerView
          notebookId={citations.notebookId}
          statements={live.statements}
          finished={false}
          onOpenCitation={citations.onOpenCitation}
        />
        <p className="mt-2 flex items-center gap-2 text-ui text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Antwort wird geschrieben …
        </p>
      </div>
    </>
  );
}

/** The saved messages by day, the questions to ask next after the last answer, and the live turn. */
function Messages({
  messages,
  live,
  canAsk,
  onAsk,
  citations,
}: {
  messages: ChatMessage[];
  live: LiveAnswer | null;
  canAsk: boolean;
  onAsk: (question: string) => void;
  citations: Citations;
}) {
  // Only the last answer of the conversation suggests what to ask next, and only while it is the last.
  const last = messages.at(-1);
  const followUps = last?.role === CHAT_ROLE.ASSISTANT ? last.followUps : [];
  return (
    <>
      {messages.map((message, index) => (
        <Fragment key={message.id}>
          {startsDay(messages[index - 1], message.createdAt) && (
            <DayDivider iso={message.createdAt} />
          )}
          <MessageView
            message={message}
            notebookId={citations.notebookId}
            onOpenCitation={citations.onOpenCitation}
          />
        </Fragment>
      ))}
      {followUps.length > 0 && !live && (
        <div className="pr-8">
          <FollowUps questions={followUps} disabled={!canAsk} onAsk={onAsk} />
        </div>
      )}
      {live && <LiveTurn live={live} previous={last} citations={citations} />}
    </>
  );
}

/** The conversation: loading, the empty chat, or the messages (the fourth state is the live turn). */
export function Conversation({
  history,
  ask,
  hasReady,
  suggestions,
  canAsk,
  citations,
}: {
  history: UseQueryResult<ChatMessage[]>;
  ask: ReturnType<typeof useAskQuestion>;
  hasReady: boolean;
  suggestions: Suggestions;
  canAsk: boolean;
  citations: Citations;
}) {
  return (
    <QueryBoundary
      query={history}
      // The overview has placeholders of its own while it loads, a second set would double them.
      loading={hasReady ? null : <ChatSkeleton />}
      isEmpty={(messages) => messages.length === 0 && !ask.live}
      empty={
        <EmptyChat
          hasReady={hasReady}
          suggestions={suggestions}
          canAsk={canAsk}
          onAsk={ask.mutate}
        />
      }
    >
      {(messages) => (
        <Messages
          messages={messages}
          live={ask.live}
          canAsk={canAsk}
          onAsk={ask.mutate}
          citations={citations}
        />
      )}
    </QueryBoundary>
  );
}
