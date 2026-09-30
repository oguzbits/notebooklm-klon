import { API_ERROR, SOURCE_KIND } from '@nlm/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CHUNK_ID, chunkDetail, NOTEBOOK_ID, SOURCE_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { ReaderPanel } from './reader-panel';

const TEXT = 'Vorwort. Dr. Brandt leitet das Projekt Nordlicht. Ende.';
const sourceText = () =>
  http.get(`*/api/notebooks/${NOTEBOOK_ID}/sources/${SOURCE_ID}/text`, () =>
    HttpResponse.json({
      id: SOURCE_ID,
      title: 'projekt.pdf',
      kind: SOURCE_KIND.PDF,
      sourceUrl: null,
      text: TEXT,
    })
  );

describe('ReaderPanel', () => {
  it('shows the source text with the cited passage highlighted', async () => {
    server.use(
      sourceText(),
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json(chunkDetail({ startOffset: 9, endOffset: 49 }))
      )
    );
    renderWithProviders(
      <ReaderPanel notebookId={NOTEBOOK_ID} target={{ chunkId: CHUNK_ID }} onClose={() => {}} />
    );

    const mark = await screen.findByText('Dr. Brandt leitet das Projekt Nordlicht.', {
      selector: 'mark',
    });

    expect(mark).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'projekt.pdf' })).toBeTruthy();
  });

  it('shows a whole source without a highlight when it is opened from the list', async () => {
    server.use(sourceText());
    renderWithProviders(
      <ReaderPanel notebookId={NOTEBOOK_ID} target={{ sourceId: SOURCE_ID }} onClose={() => {}} />
    );

    expect(await screen.findByText(TEXT)).toBeTruthy();
    expect(document.querySelector('mark')).toBeNull();
  });

  it('says so when the cited source is no longer in the notebook', async () => {
    server.use(
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json({ code: API_ERROR.NOT_FOUND }, { status: 404 })
      )
    );
    renderWithProviders(
      <ReaderPanel notebookId={NOTEBOOK_ID} target={{ chunkId: CHUNK_ID }} onClose={() => {}} />
    );

    expect(await screen.findByText(/nicht mehr in deinem Notizbuch/)).toBeTruthy();
  });

  it('goes back to the sources', async () => {
    server.use(sourceText());
    const onClose = vi.fn();
    renderWithProviders(
      <ReaderPanel notebookId={NOTEBOOK_ID} target={{ sourceId: SOURCE_ID }} onClose={onClose} />
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /Zurück zu den Quellen/ }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
