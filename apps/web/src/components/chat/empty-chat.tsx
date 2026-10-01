import { MessageCircleQuestion } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { Suggestions } from '@/hooks/use-overview';

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

/**
 * What the chat says while there is no conversation. With a source that is read, the overview of
 * the notebook leads and only a hint and the questions follow; without one it asks for a first question.
 */
export function EmptyChat({
  hasReady,
  suggestions,
  canAsk,
  onAsk,
}: {
  hasReady: boolean;
  suggestions: Suggestions;
  canAsk: boolean;
  onAsk: (question: string) => void;
}) {
  const list = <SuggestionList suggestions={suggestions} canAsk={canAsk} onAsk={onAsk} />;
  if (hasReady) {
    return (
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <p className="max-w-sm text-ui text-muted-foreground">
          Jede Aussage einer Antwort hat eine Nummer, die zur Textstelle führt.
        </p>
        {list}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <MessageCircleQuestion className="size-12 text-muted-foreground" aria-hidden />
      <p className="text-xl font-title">Stelle deine erste Frage</p>
      <p className="max-w-sm text-read text-muted-foreground">
        Die Antwort stützt sich nur auf deine ausgewählten Quellen. Jede Aussage hat eine Nummer,
        die zur Textstelle führt.
      </p>
      {list}
    </div>
  );
}
