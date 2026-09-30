import { type AnswerStatement, CHAT_ROLE, type ChatMessage } from '@nlm/shared';

import { CitationChip } from '@/components/chat/citation-chip';
import { SaveNoteButton } from '@/components/chat/save-note-button';
import { numberCitations } from '@/lib/citations';

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
    <p className="leading-relaxed">
      {numberCitations(statements).map((statement, index) => (
        <span key={index}>
          {statement.text}
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

export function QuestionBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-primary-foreground">
        {text}
      </p>
    </div>
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
  if (message.role === CHAT_ROLE.USER) return <QuestionBubble text={message.text} />;
  return (
    <div className="max-w-[92%]">
      <AnswerView
        notebookId={notebookId}
        statements={message.statements}
        finished
        onOpenCitation={onOpenCitation}
      />
      {message.statements.length > 0 && (
        <SaveNoteButton notebookId={notebookId} messageId={message.id} />
      )}
    </div>
  );
}
