import {
  SOURCE_STATUS,
  type SourceOverview,
  SourceOverviewSchema,
  type SourceSummary,
} from '@nlm/shared';
import { useQueries, useQuery } from '@tanstack/react-query';

import { api, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

const SUGGESTION_SOURCES = 3;
const QUESTIONS_PER_SOURCE = 2;
const MAX_SUGGESTIONS = 4;

const overviewQuery = (notebookId: string, sourceId: string) => ({
  queryKey: queryKeys.overview(notebookId, sourceId),
  queryFn: async () =>
    readJson(
      await api.api.notebooks[':notebookId'].sources[':sourceId'].overview.$get({
        param: { notebookId, sourceId },
      }),
      SourceOverviewSchema
    ),
  // The server stores the overview once, and a source never changes.
  staleTime: Infinity,
  retry: false,
});

/** The summary, key topics and suggested questions of one source. Only loaded when `enabled`. */
export function useOverview(notebookId: string, sourceId: string, enabled: boolean) {
  return useQuery({ ...overviewQuery(notebookId, sourceId), enabled });
}

export interface Suggestions {
  questions: string[];
  /** The overviews are still being made. */
  loading: boolean;
  /** None could be made, and there is nothing else to show. */
  failed: boolean;
}

/** Questions to start with, taken from the first few sources that are selected and ready. */
export function useSuggestedQuestions(notebookId: string, sources: SourceSummary[]): Suggestions {
  const ids = sources
    .filter((source) => source.selected && source.status === SOURCE_STATUS.READY)
    .slice(0, SUGGESTION_SOURCES)
    .map((source) => source.id);
  const results = useQueries({ queries: ids.map((id) => overviewQuery(notebookId, id)) });

  const overviews = results.flatMap((result) => (result.data ? [result.data] : []));
  return {
    questions: pickQuestions(overviews),
    loading: results.some((result) => result.isPending),
    failed: results.length > 0 && overviews.length === 0 && results.every((r) => r.isError),
  };
}

function pickQuestions(overviews: SourceOverview[]): string[] {
  const questions = overviews.flatMap((o) => o.suggestedQuestions.slice(0, QUESTIONS_PER_SOURCE));
  return [...new Set(questions)].slice(0, MAX_SUGGESTIONS);
}
