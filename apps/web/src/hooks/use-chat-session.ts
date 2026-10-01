import { SOURCE_STATUS } from '@nlm/shared';

import { useAskQuestion, useChatHistory } from '@/hooks/use-chat';
import { useSuggestedQuestions } from '@/hooks/use-overview';
import { useSources } from '@/hooks/use-sources';

/** The conversation of a notebook with what the chat needs to know about its sources. */
export function useChatSession(notebookId: string) {
  const history = useChatHistory(notebookId);
  const sources = useSources(notebookId);
  const ask = useAskQuestion(notebookId);
  const suggestions = useSuggestedQuestions(notebookId, sources.data ?? []);

  const list = sources.data ?? [];
  const usable = list.filter(
    (source) => source.selected && source.status === SOURCE_STATUS.READY
  ).length;
  return {
    history,
    sources,
    ask,
    suggestions,
    usable,
    // With a source that is read, the overview of the notebook leads the chat.
    hasReady: list.some((source) => source.status === SOURCE_STATUS.READY),
    canAsk: usable > 0 && !ask.isPending,
  };
}
