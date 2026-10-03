import { describe, expect, it } from 'vitest';

import {
  MAX_WEB_RESULTS,
  WebSearchBodySchema,
  WebSearchResponseSchema,
  WebSearchResultSchema,
} from './index';

const RESULT = {
  title: 'Retrieval-augmented generation – Wikipedia',
  url: 'https://de.wikipedia.org/wiki/RAG',
  snippet: 'RAG verbindet ein Sprachmodell mit einer Suche.',
};

describe('web search contracts', () => {
  it('trims the query and refuses a short or a very long one', () => {
    expect(WebSearchBodySchema.parse({ query: '  RAG erklärt ' })).toEqual({
      query: 'RAG erklärt',
    });
    expect(WebSearchBodySchema.safeParse({ query: 'a' }).success).toBe(false);
    expect(WebSearchBodySchema.safeParse({ query: 'x'.repeat(201) }).success).toBe(false);
  });

  it('accepts only web addresses as a result', () => {
    expect(WebSearchResultSchema.parse(RESULT)).toEqual(RESULT);
    expect(WebSearchResultSchema.safeParse({ ...RESULT, url: 'file:///etc/passwd' }).success).toBe(
      false
    );
    expect(WebSearchResultSchema.safeParse({ ...RESULT, url: 'javascript:alert(1)' }).success).toBe(
      false
    );
    expect(WebSearchResultSchema.safeParse({ ...RESULT, title: ' ' }).success).toBe(false);
  });

  it('limits the number of results', () => {
    const many = Array.from({ length: MAX_WEB_RESULTS + 1 }, () => RESULT);

    expect(WebSearchResponseSchema.safeParse({ results: many }).success).toBe(false);
    expect(WebSearchResponseSchema.safeParse({ results: many.slice(1) }).success).toBe(true);
    expect(WebSearchResponseSchema.parse({ results: [] })).toEqual({ results: [] });
  });
});
