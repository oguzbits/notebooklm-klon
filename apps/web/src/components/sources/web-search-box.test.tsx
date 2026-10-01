import { API_ERROR, SUBMIT_ACTION } from '@nlm/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { NOTEBOOK_ID, SOURCE_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { WebSearchBox } from './web-search-box';

const RESULTS = [
  { title: 'RAG – Wikipedia', url: 'https://de.wikipedia.org/wiki/RAG', snippet: 'Erster Text.' },
  { title: 'Doku zu RAG', url: 'https://example.org/doku', snippet: 'Zweiter Text.' },
];
const capabilities = (webSearch: boolean) =>
  http.get('*/api/capabilities', () => HttpResponse.json({ webSearch }));
const search = (results: unknown[] = RESULTS) =>
  http.post('*/api/web-search', () => HttpResponse.json({ results }));

const renderBox = () => renderWithProviders(<WebSearchBox notebookId={NOTEBOOK_ID} />);
const ask = async (user: ReturnType<typeof userEvent.setup>, text = 'RAG erklärt') => {
  await user.type(
    await screen.findByRole('textbox', { name: 'Im Web nach neuen Quellen suchen' }),
    text
  );
  await user.click(screen.getByRole('button', { name: 'Suchen' }));
};

describe('WebSearchBox', () => {
  it('is not offered where the search is not set up', async () => {
    server.use(capabilities(false));
    renderBox();

    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Suchen' })).toBeNull();
  });

  it('cannot search with an empty field', async () => {
    server.use(capabilities(true));
    renderBox();

    const button = await screen.findByRole('button', { name: 'Suchen' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the pages that were found and adds one as a source', async () => {
    let added: unknown;
    server.use(
      capabilities(true),
      search(),
      http.post(`*/api/notebooks/${NOTEBOOK_ID}/sources/url`, async ({ request }) => {
        added = await request.json();
        return HttpResponse.json(
          { sourceId: SOURCE_ID, action: SUBMIT_ACTION.CREATED },
          { status: 201 }
        );
      })
    );
    renderBox();
    const user = userEvent.setup();

    await ask(user);
    const list = await screen.findByRole('list', { name: 'Gefundene Seiten' });
    expect(within(list).getByText('RAG – Wikipedia')).toBeTruthy();
    expect(within(list).getByText('de.wikipedia.org')).toBeTruthy();
    expect(within(list).getByText('Zweiter Text.')).toBeTruthy();
    await user.click(
      within(list).getByRole('button', { name: 'RAG – Wikipedia als Quelle hinzufügen' })
    );

    await waitFor(() => expect(added).toEqual({ url: 'https://de.wikipedia.org/wiki/RAG' }));
    expect(await within(list).findByText('Hinzugefügt')).toBeTruthy();
    // The other page can still be added.
    expect(
      within(list).getByRole('button', { name: 'Doku zu RAG als Quelle hinzufügen' })
    ).toBeTruthy();
  });

  it('says when nothing was found', async () => {
    server.use(capabilities(true), search([]));
    renderBox();

    await ask(userEvent.setup());

    expect(await screen.findByText('Dazu wurde nichts gefunden.')).toBeTruthy();
  });

  it('says so with a retry when the search failed', async () => {
    let failing = true;
    server.use(
      capabilities(true),
      http.post('*/api/web-search', () =>
        failing
          ? HttpResponse.json({ code: API_ERROR.WEB_SEARCH_LIMIT_REACHED }, { status: 429 })
          : HttpResponse.json({ results: RESULTS })
      )
    );
    renderBox();
    const user = userEvent.setup();

    await ask(user);
    expect(await screen.findByText(/Limit erreicht/)).toBeTruthy();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('RAG – Wikipedia')).toBeTruthy();
  });

  it('disables the field while it searches, so a second search cannot start', async () => {
    const asked = vi.fn();
    server.use(
      capabilities(true),
      http.post('*/api/web-search', async () => {
        asked();
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ results: RESULTS });
      })
    );
    renderBox();
    const user = userEvent.setup();

    await ask(user);

    expect(screen.getByRole('status', { name: 'Suche läuft' })).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    await screen.findByText('RAG – Wikipedia');
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('closes the list of results', async () => {
    server.use(capabilities(true), search());
    renderBox();
    const user = userEvent.setup();

    await ask(user);
    await screen.findByRole('list', { name: 'Gefundene Seiten' });
    await user.click(screen.getByRole('button', { name: 'Ergebnisse schließen' }));

    expect(screen.queryByRole('list', { name: 'Gefundene Seiten' })).toBeNull();
  });
});
