import { SOURCE_STATUS } from '@nlm/shared';

import { useAskQuestion, useChatHistory } from '@/hooks/use-chat';
import { type IncomingQuestion, useIncomingQuestion } from '@/hooks/use-incoming-question';
import { useSuggestedQuestions } from '@/hooks/use-overview';
import { useSources } from '@/hooks/use-sources';
import { useChatLimit } from '@/hooks/use-usage';
import { tr } from '@/lib/i18n';

const NO_SOURCE_HINT = tr(
  'Wähle links mindestens eine fertig gelesene Quelle aus, um Fragen zu stellen.',
  'Select at least one source on the left that has finished loading to ask questions.'
);

const NOT_ASKED_HINT = tr('Die Frage wurde nicht gestellt. ', 'The question was not asked. ');

/**
 * The conversation of a notebook with what the chat needs to know about its sources, and the question
 * from elsewhere on the page. `hint` says why nothing can be asked, or null.
 */
export function useChatSession(notebookId: string, incoming: IncomingQuestion | null) {
  const history = useChatHistory(notebookId);
  const sources = useSources(notebookId);
  const ask = useAskQuestion(notebookId);
  const suggestions = useSuggestedQuestions(notebookId, sources.data ?? []);
  const limit = useChatLimit();

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
    canAsk: usable > 0 && !ask.isPending && !limit.locked,
    limit,
    hint:
      sources.isSuccess && usable === 0
        ? `${dropped ? NOT_ASKED_HINT : ''}${NO_SOURCE_HINT}`
        : null,
  };
}
