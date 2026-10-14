import { UsageStatusSchema } from '@nlm/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { describeLimit, LIMIT_WORDS } from '@/lib/usage-note';

/**
 * How much of the limits is used. A failed read is no reason to lock anything: the server checks
 * the limits again with every request, this is only the note for the reader.
 */
function useUsage() {
  return useQuery({
    queryKey: queryKeys.usage,
    queryFn: async () => readJson(await api.api.usage.$get(), UsageStatusSchema),
  });
}

/** Whether the field for a question is locked by the limit, and the note to show under it. */
export function useChatLimit() {
  const { data } = useUsage();
  return describeLimit(
    data && { limit: data.chat, budgetReached: data.budgetReached },
    LIMIT_WORDS.CHAT,
    new Date()
  );
}

/** The same for the outputs of the Studio. */
export function useStudioLimit() {
  const { data } = useUsage();
  return describeLimit(
    data && { limit: data.studio, budgetReached: data.budgetReached },
    LIMIT_WORDS.STUDIO,
    new Date()
  );
}

/** Reads the counts again, after something was asked or made (or refused). */
export function useRefreshUsage() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.usage });
}
