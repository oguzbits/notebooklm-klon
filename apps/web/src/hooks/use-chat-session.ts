import { SOURCE_STATUS } from '@nlm/shared';

import { useAskQuestion, useChatHistory } from '@/hooks/use-chat';
import { type IncomingQuestion, useIncomingQuestion } from '@/hooks/use-incoming-question';
import { useSuggestedQuestions } from '@/hooks/use-overview';
import { useSources } from '@/hooks/use-sources';

const NO_SOURCE_HINT =
  'Wähle links mindestens eine fertig gelesene Quelle aus, um Fragen zu stellen.';

const NOT_ASKED_HINT = 'Die Frage wurde nicht gestellt. ';

/**
 * The conversation of a notebook with what the chat needs to know about its sources, and the question
 * from elsewhere on the page. `hint` says why nothing can be asked, or null.
 */
export function useChatSession(notebookId: string, incoming: IncomingQuestion | null) {
  const history = useChatHistory(notebookId);
  const sources = useSources(notebookId);
  const ask = useAskQuestion(notebookId);
  const suggestions = useSuggestedQuestions(notebookId, sources.data ?? []);

  const list = sources.data ?? [];
  const usable = list.filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  const { dropped } = useIncomingQuestion(
    incoming,
    { hasSource: usable > 0, pending: ask.isPending },
    ask.mutate
  );
  return {
    history,
    sources,
    ask,
    suggestions,
    usable,
    // With a source that is read, the overview of the notebook leads the chat.
    hasReady: list.some((source) => source.status === SOURCE_STATUS.READY),
    canAsk: usable > 0 && !ask.isPending,
    hint:
      sources.isSuccess && usable === 0
        ? `${dropped ? NOT_ASKED_HINT : ''}${NO_SOURCE_HINT}`
        : null,
  };
}
