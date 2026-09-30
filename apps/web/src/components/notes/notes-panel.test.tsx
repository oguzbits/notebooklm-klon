import { API_ERROR, SUBMIT_ACTION } from '@nlm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHUNK_ID, note, NOTE_ID, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NotesSection } from './notes-panel';

const base = `*/api/notebooks/${NOTEBOOK_ID}/notes`;

function renderPanel(onOpenCitation: (chunkId: string) => void = () => {}) {
  return renderWithProviders(
    <NotesSection notebookId={NOTEBOOK_ID} onOpenCitation={onOpenCitation} />
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('NotesSection', () => {
  it('explains how to make a note when there is none', async () => {
    server.use(http.get(base, () => HttpResponse.json([])));
    renderPanel();

    expect(await screen.findByText('Noch keine Notizen')).toBeTruthy();
  });

  it('shows a note with a chip that opens the cited passage', async () => {
    server.use(http.get(base, () => HttpResponse.json([note()])));
    const onOpen = vi.fn();
    renderPanel(onOpen);

    expect(await screen.findByText(/Dr\. Brandt leitet es\./)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Quelle 1 anzeigen' }));

    expect(onOpen).toHaveBeenCalledWith(CHUNK_ID);
  });

  it('adds a note as a source: the text of the note goes up as a text file', async () => {
    server.use(http.get(base, () => HttpResponse.json([note()])));
    const uploads: File[] = [];
    const realFetch = globalThis.fetch;
    // Only the upload is answered here (jsdom's FormData is no body for Node's fetch).
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (!String(input).endsWith('/sources/file')) return realFetch(input, init);
        uploads.push((init?.body as FormData).get('file') as File);
        return Response.json(
          { sourceId: '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22', action: SUBMIT_ACTION.CREATED },
          { status: 202 }
        );
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Notiz als Quelle hinzufügen' }));

    expect(await screen.findByText('Als Quelle hinzugefügt')).toBeTruthy();
    expect(uploads[0]?.name).toMatch(/^Notiz vom .+\.txt$/);
    expect(await uploads[0]?.text()).toBe('Dr. Brandt leitet es.');
  });

  it('deletes a note after the confirmation', async () => {
    let deleted = false;
    server.use(
      http.get(base, () => HttpResponse.json(deleted ? [] : [note()])),
      http.delete(`${base}/${NOTE_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Notiz löschen' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByText('Noch keine Notizen')).toBeTruthy();
  });

  it('shows a retry when the notes cannot be loaded', async () => {
    server.use(
      http.get(base, () => HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 }))
    );
    renderPanel();

    expect(await screen.findByRole('button', { name: /Erneut versuchen/ })).toBeTruthy();
  });
});
