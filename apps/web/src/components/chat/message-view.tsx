import { type AnswerStatement, CHAT_ROLE, type ChatMessage } from '@nlm/shared';

import { CitationChip } from '@/components/chat/citation-chip';
import { CopyAnswerButton } from '@/components/chat/copy-answer-button';
import { InlineText } from '@/components/chat/inline-text';
import { SaveNoteButton } from '@/components/chat/save-note-button';
import { numberCitations } from '@/lib/citations';
import { messageTime } from '@/lib/relative-time';

const NO_ANSWER = 'Dazu habe ich in den ausgewählten Quellen keine belegte Antwort gefunden.';

interface AnswerViewProps {
  notebookId: string;
  statements: AnswerStatement[];
  /** Shown when the answer is finished but holds no statement. */
  finished: boolean;
  onOpenCitation: (chunkId: string) => void;
}

/** An answer as running text: each statement is followed by the chips of the passages behind it. */
export function AnswerView({ notebookId, statements, finished, onOpenCitation }: AnswerViewProps) {
  if (statements.length === 0) {
    return finished ? <p className="text-muted-foreground">{NO_ANSWER}</p> : null;
  }
  return (
    <p className="text-read text-body">
      {numberCitations(statements).map((statement, index) => (
        <span key={index}>
          <InlineText text={statement.text} />
          {statement.citations.map((citation) => (
            <CitationChip
              key={citation.chunkId}
              notebookId={notebookId}
              chunkId={citation.chunkId}
              number={citation.number}
              onOpen={onOpenCitation}
            />
          ))}{' '}
        </span>
      ))}
    </p>
  );
}

/** "Heute • 20:51" above a question, small and in the middle. */
function MessageTime({ iso }: { iso: string }) {
  return (
    <time
      dateTime={iso}
      className="mt-4 mb-0 block text-center text-[0.75rem] leading-4 font-[500] tracking-[0.006em] text-meta"
    >
      {messageTime(iso)}
    </time>
  );
}

export function QuestionBubble({ text, askedAt }: { text: string; askedAt: string }) {
  return (
    <>
      <MessageTime iso={askedAt} />
      <div className="flex justify-end">
        <p className="text-read ml-8 w-full max-w-[700px] rounded-bubble bg-secondary px-7 py-5 text-body">
          {text}
        </p>
      </div>
    </>
  );
}

export function MessageView({
  message,
  notebookId,
  onOpenCitation,
}: {
  message: ChatMessage;
  notebookId: string;
  onOpenCitation: (chunkId: string) => void;
}) {
  if (message.role === CHAT_ROLE.USER) {
    return <QuestionBubble text={message.text} askedAt={message.createdAt} />;
  }
  return (
    <div className="pr-8">
      <AnswerView
        notebookId={notebookId}
        statements={message.statements}
        finished
        onOpenCitation={onOpenCitation}
      />
      {message.statements.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center">
          <CopyAnswerButton statements={message.statements} />
          <SaveNoteButton notebookId={notebookId} messageId={message.id} />
        </div>
      )}
    </div>
  );
}
