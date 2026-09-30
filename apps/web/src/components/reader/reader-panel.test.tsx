import { API_ERROR, SOURCE_KIND } from '@nlm/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CHUNK_ID, chunkDetail, NOTEBOOK_ID, overview, SOURCE_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { CloseReaderButton, ReaderPanel } from './reader-panel';

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

const overviewOfSource = () =>
  http.get(`*/api/notebooks/${NOTEBOOK_ID}/sources/${SOURCE_ID}/overview`, () =>
    HttpResponse.json(
      overview({ summary: 'Eine kurze Zusammenfassung.', keyTopics: ['Nordlicht'] })
    )
  );

describe('ReaderPanel', () => {
  it('shows the source text with the cited passage highlighted', async () => {
    server.use(
      sourceText(),
      overviewOfSource(),
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json(chunkDetail({ startOffset: 9, endOffset: 49 }))
      )
    );
    renderWithProviders(<ReaderPanel notebookId={NOTEBOOK_ID} target={{ chunkId: CHUNK_ID }} />);

    const mark = await screen.findByText('Dr. Brandt leitet das Projekt Nordlicht.', {
      selector: 'mark',
    });

    expect(mark).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'projekt.pdf' })).toBeTruthy();
  });

  it('shows a whole source without a highlight when it is opened from the list', async () => {
    server.use(sourceText(), overviewOfSource());
    renderWithProviders(<ReaderPanel notebookId={NOTEBOOK_ID} target={{ sourceId: SOURCE_ID }} />);

    expect(await screen.findByText(TEXT)).toBeTruthy();
    expect(document.querySelector('mark')).toBeNull();
  });

  it('says so when the cited source is no longer in the notebook', async () => {
    server.use(
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/chunks/${CHUNK_ID}`, () =>
        HttpResponse.json({ code: API_ERROR.NOT_FOUND }, { status: 404 })
      )
    );
    renderWithProviders(<ReaderPanel notebookId={NOTEBOOK_ID} target={{ chunkId: CHUNK_ID }} />);

    expect(await screen.findByText(/nicht mehr in deinem Notizbuch/)).toBeTruthy();
  });

  it('shows the summary of the source on a card that folds away', async () => {
    server.use(sourceText(), overviewOfSource());
    renderWithProviders(<ReaderPanel notebookId={NOTEBOOK_ID} target={{ sourceId: SOURCE_ID }} />);
    const user = userEvent.setup();

    expect(await screen.findByText('Eine kurze Zusammenfassung.')).toBeTruthy();
    expect(screen.getByText('Nordlicht')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Quellenübersicht schließen' }));

    expect(screen.queryByText('Eine kurze Zusammenfassung.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Quellenübersicht öffnen' })).toBeTruthy();
  });
});

describe('the summary card', () => {
  it('shows a retry when the summary cannot be made', async () => {
    let failing = true;
    server.use(
      sourceText(),
      http.get(`*/api/notebooks/${NOTEBOOK_ID}/sources/${SOURCE_ID}/overview`, () =>
        failing
          ? HttpResponse.json({ code: API_ERROR.CHAT_LIMIT_REACHED }, { status: 429 })
          : HttpResponse.json(overview({ summary: 'Jetzt ist sie da.' }))
      )
    );
    renderWithProviders(<ReaderPanel notebookId={NOTEBOOK_ID} target={{ sourceId: SOURCE_ID }} />);
    const user = userEvent.setup();

    expect(await screen.findByText(/keine Antworten mehr möglich/)).toBeTruthy();
    failing = false;
    await user.click(screen.getByRole('button', { name: /Erneut versuchen/ }));

    expect(await screen.findByText('Jetzt ist sie da.')).toBeTruthy();
  });
});

describe('CloseReaderButton', () => {
  it('leaves the reader', async () => {
    const onClick = vi.fn();
    renderWithProviders(<CloseReaderButton onClick={onClick} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quellenansicht schließen' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
