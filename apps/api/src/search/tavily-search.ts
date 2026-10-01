import { MAX_WEB_RESULTS, type WebSearchResult, WebSearchResultSchema } from '@nlm/shared';
import { z } from 'zod';

const ENDPOINT = 'https://api.tavily.com/search';
const SEARCH_DEPTH = 'basic';
const MAX_SNIPPET_CHARS = 500;
/** Rate limit, key limit and pay-as-you-go limit of Tavily: the quota is used up. */
const QUOTA_STATUSES = new Set([429, 432, 433]);

const ResponseSchema = z.object({
  results: z.array(
    z.object({ title: z.string(), url: z.string(), content: z.string().default('') })
  ),
});

/** A search that failed. The message never carries the answer of the service. */
export class WebSearchError extends Error {
  constructor(
    readonly status: number,
    readonly quotaExhausted: boolean
  ) {
    super(`The web search failed with status ${status}.`);
    this.name = 'WebSearchError';
  }
}

/** What the routes need from a web search. Fakes in tests, Tavily in production. */
export interface WebSearch {
  search: (query: string, signal?: AbortSignal) => Promise<WebSearchResult[]>;
}

/**
 * Looks up pages for a query with Tavily (basic search, 1 credit). Only results that are web
 * addresses with a title are kept, so what reaches the reader can be added as a source.
 */
export function createTavilySearch(config: { apiKey: string }): WebSearch {
  return {
    async search(query, signal) {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ query, search_depth: SEARCH_DEPTH, max_results: MAX_WEB_RESULTS }),
        signal,
      });
      if (!response.ok)
        throw new WebSearchError(response.status, QUOTA_STATUSES.has(response.status));

      const { results } = ResponseSchema.parse(await response.json());
      return results.flatMap((result) => {
        const parsed = WebSearchResultSchema.safeParse({
          title: result.title,
          url: result.url,
          snippet: result.content.trim().slice(0, MAX_SNIPPET_CHARS),
        });
        return parsed.success ? [parsed.data] : [];
      });
    },
  };
}
