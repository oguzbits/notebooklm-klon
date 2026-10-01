import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../vitest.setup';
import { createTavilySearch, WebSearchError } from './tavily-search';

const ENDPOINT = 'https://api.tavily.com/search';
const KEY = 'tvly-test-key-not-real';
const search = createTavilySearch({ apiKey: KEY });

describe('createTavilySearch', () => {
  it('sends the key as a bearer token and a basic search for at most five results', async () => {
    let auth: string | null = null;
    let body: unknown;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        auth = request.headers.get('authorization');
        body = await request.json();
        return HttpResponse.json({ results: [] });
      })
    );

    await search.search('RAG erklärt');

    expect(auth).toBe(`Bearer ${KEY}`);
    expect(body).toEqual({ query: 'RAG erklärt', search_depth: 'basic', max_results: 5 });
  });

  it('returns title, address and a snippet of each result', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({
          results: [
            {
              title: 'RAG – Wikipedia',
              url: 'https://de.wikipedia.org/wiki/RAG',
              content: 'Text eins.',
              score: 0.9,
            },
            { title: 'Doku', url: 'https://example.org/doku', content: 'Text zwei.', score: 0.5 },
          ],
        })
      )
    );

    expect(await search.search('RAG')).toEqual([
      { title: 'RAG – Wikipedia', url: 'https://de.wikipedia.org/wiki/RAG', snippet: 'Text eins.' },
      { title: 'Doku', url: 'https://example.org/doku', snippet: 'Text zwei.' },
    ]);
  });

  it('leaves out results that are no web address or have no title, and shortens long snippets', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({
          results: [
            { title: 'Gut', url: 'https://example.org/a', content: 'x'.repeat(900) },
            { title: 'Datei', url: 'file:///etc/passwd', content: 'nein' },
            { title: '  ', url: 'https://example.org/b', content: 'leer' },
          ],
        })
      )
    );

    const results = await search.search('RAG');

    expect(results.map((result) => result.title)).toEqual(['Gut']);
    expect(results[0]?.snippet.length).toBeLessThanOrEqual(500);
  });

  it('reports a used-up quota with its status', async () => {
    for (const status of [429, 432, 433]) {
      server.use(http.post(ENDPOINT, () => HttpResponse.json({}, { status })));

      await expect(search.search('RAG')).rejects.toMatchObject({
        name: 'WebSearchError',
        quotaExhausted: true,
        status,
      });
    }
  });

  it('fails on any other error status, without the answer in the message', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json({ detail: 'GEHEIM' }, { status: 401 })));

    const error = await search.search('RAG').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(WebSearchError);
    expect(error).toMatchObject({ status: 401, quotaExhausted: false });
    expect(String((error as Error).message)).not.toContain('GEHEIM');
  });

  it('fails when the answer does not have the expected shape', async () => {
    server.use(http.post(ENDPOINT, () => HttpResponse.json({ nope: true })));

    await expect(search.search('RAG')).rejects.toThrow();
  });
});
