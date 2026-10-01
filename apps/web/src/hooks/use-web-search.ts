import { CapabilitiesSchema, WebSearchResponseSchema } from '@nlm/shared';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api, readJson } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

/** What this installation offers. The web search box shows only where the search is set up. */
export function useCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: async () => readJson(await api.api.capabilities.$get(), CapabilitiesSchema),
    staleTime: Infinity,
  });
}

/** Looks up pages for a query. Nothing is kept: a search is asked again, not cached. */
export function useWebSearch() {
  return useMutation({
    mutationFn: async (query: string) =>
      readJson(await api.api['web-search'].$post({ json: { query } }), WebSearchResponseSchema),
  });
}
