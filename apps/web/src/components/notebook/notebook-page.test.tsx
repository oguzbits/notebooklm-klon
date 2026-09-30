import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { notebook, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NotebookPage } from './notebook-page';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/notizbuecher/:notebookId" element={<NotebookPage />} />
    </Routes>,
    `/notizbuecher/${NOTEBOOK_ID}`
  );
}

/** A request that is not answered yet, so the page stays in its loading state. */
const pending = () => new Promise<never>(() => {});

describe('NotebookPage', () => {
  it('keeps its three columns while the notebook loads and shows a placeholder in each', () => {
    server.use(
      http.get('*/api/notebooks', pending),
      http.get('*/api/auth/get-session', pending),
      http.get(`${base}/sources`, pending),
      http.get(`${base}/messages`, pending),
      http.get(`${base}/studio`, pending),
      http.get(`${base}/notes`, pending)
    );
    renderPage();

    for (const name of ['Quellen', 'Chat', 'Studio']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    expect(
      within(screen.getByRole('region', { name: 'Quellen' })).getByRole('status', {
        name: 'Wird geladen',
      })
    ).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Chat' })).getByRole('status', {
        name: 'Wird geladen',
      })
    ).toBeTruthy();
    // The tiles of the Studio need nothing from the server and are there at once.
    expect(screen.getByRole('button', { name: 'Quiz' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('puts the title in once the notebook is there', async () => {
    server.use(
      http.get('*/api/notebooks', () =>
        HttpResponse.json([notebook({ id: NOTEBOOK_ID, title: 'Forschung' })])
      ),
      http.get('*/api/auth/get-session', pending),
      http.get(`${base}/sources`, pending),
      http.get(`${base}/messages`, pending),
      http.get(`${base}/studio`, pending),
      http.get(`${base}/notes`, pending)
    );
    renderPage();

    expect(await screen.findByRole('textbox', { name: 'Titel des Notizbuchs' })).toHaveProperty(
      'value',
      'Forschung'
    );
  });
});
