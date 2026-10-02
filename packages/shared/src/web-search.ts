import { z } from 'zod';

/** What a search query may be: the field and the schema use the same numbers. */
export const WEB_SEARCH_QUERY = { MIN_CHARS: 2, MAX_CHARS: 200 } as const;
const MAX_TITLE_CHARS = 300;
/** The longest snippet a suggestion carries; the search adapter cuts to it. */
export const WEB_SEARCH_SNIPPET_MAX_CHARS = 500;
const MAX_URL_CHARS = 2048;
/** How many suggestions one search returns at most. */
export const MAX_WEB_RESULTS = 5;
const HTTP_URL = /^https?:\/\//i;

export const WebSearchBodySchema = z.object({
  query: z.string().trim().min(WEB_SEARCH_QUERY.MIN_CHARS).max(WEB_SEARCH_QUERY.MAX_CHARS),
});

/** One suggestion of the web search: a page the reader can add as a source. */
export const WebSearchResultSchema = z.object({
  title: z.string().trim().min(1).max(MAX_TITLE_CHARS),
  url: z.string().max(MAX_URL_CHARS).regex(HTTP_URL).pipe(z.url()),
  /** A few sentences of what the page is about, from the search service. */
  snippet: z.string().trim().max(WEB_SEARCH_SNIPPET_MAX_CHARS),
});

export const WebSearchResponseSchema = z.object({
  results: z.array(WebSearchResultSchema).max(MAX_WEB_RESULTS),
});

/** What the server can do in this installation, so the UI offers only that. */
export const CapabilitiesSchema = z.object({ webSearch: z.boolean(), coverImage: z.boolean() });

export type WebSearchResult = z.infer<typeof WebSearchResultSchema>;
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
