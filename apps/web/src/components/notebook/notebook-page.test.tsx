import { SOURCE_KIND } from '@nlm/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/lib/routes';
import { notebook, NOTEBOOK_ID, source } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NotebookPage } from './notebook-page';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path={ROUTES.NOTEBOOK_PATTERN} element={<NotebookPage />} />
    </Routes>,
    ROUTES.notebook(NOTEBOOK_ID)
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

    expect(await screen.findByRole('textbox', { name: 'Titel des Notebooks' })).toHaveProperty(
      'value',
      'Forschung'
    );
  });

  it('shows the title of the notebook in the browser tab and restores the old one on leaving', async () => {
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
    document.title = 'Start';
    const { unmount } = renderPage();

    await waitFor(() => expect(document.title).toBe('Forschung'));
    unmount();
    expect(document.title).toBe('Start');
  });

  it('opens a notebook the user switches to with its own state, not the source reader of the one before', async () => {
    const OTHER_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
    const otherBase = `*/api/notebooks/${OTHER_ID}`;
    server.use(
      http.get('*/api/notebooks', () =>
        HttpResponse.json([notebook({ id: NOTEBOOK_ID }), notebook({ id: OTHER_ID })])
      ),
      http.get(`${base}/sources`, () => HttpResponse.json([source({ title: 'projekt.pdf' })])),
      http.get(`${otherBase}/sources`, () => HttpResponse.json([])),
      http.get(`${base}/sources/${source().id}/text`, () =>
        HttpResponse.json({
          id: source().id,
          title: 'projekt.pdf',
          kind: SOURCE_KIND.PDF,
          sourceUrl: null,
          text: 'Dr. Brandt leitet das Projekt.',
        })
      ),
      http.get(`${base}/sources/${source().id}/overview`, pending),
      http.get(`*/api/notebooks/*/messages`, () => HttpResponse.json([])),
      http.get(`*/api/notebooks/*/studio`, () => HttpResponse.json([])),
      http.get(`*/api/notebooks/*/notes`, () => HttpResponse.json([]))
    );
    renderWithProviders(
      <>
        <Link to={ROUTES.notebook(OTHER_ID)}>Anderes Notebook</Link>
        <Routes>
          <Route path={ROUTES.NOTEBOOK_PATTERN} element={<NotebookPage />} />
        </Routes>
      </>,
      ROUTES.notebook(NOTEBOOK_ID)
    );
    const user = userEvent.setup();

    const sources = await screen.findByRole('region', { name: 'Quellen' });
    await user.click(await within(sources).findByRole('button', { name: 'Quellen ausblenden' }));
    await user.click(within(sources).getByRole('button', { name: 'Quelle anzeigen: projekt.pdf' }));
    await within(sources).findByRole('button', { name: 'Quellenansicht schließen' });
    await user.click(screen.getByRole('link', { name: 'Anderes Notebook' }));

    // The page of the other notebook is a new tree, so the region is looked up again.
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Quellen' })).queryByRole('button', {
          name: 'Quellenansicht schließen',
        })
      ).toBeNull()
    );
  });

  describe('folding a column', () => {
    function serveNotebook() {
      server.use(
        http.get('*/api/notebooks', () => HttpResponse.json([notebook({ id: NOTEBOOK_ID })])),
        http.get(`${base}/sources`, () => HttpResponse.json([source({ title: 'projekt.pdf' })])),
        http.get(`${base}/messages`, () => HttpResponse.json([])),
        http.get(`${base}/studio`, () => HttpResponse.json([])),
        http.get(`${base}/notes`, () => HttpResponse.json([]))
      );
    }

    it('shows a rail with the sources, and the whole column again when it is opened', async () => {
      serveNotebook();
      renderPage();
      const user = userEvent.setup();

      const sources = await screen.findByRole('region', { name: 'Quellen' });
      await user.click(await within(sources).findByRole('button', { name: 'Quellen ausblenden' }));

      // The text of the sources is still in the page, behind the rail, and out of reach.
      expect(within(sources).getByText('Alle auswählen').closest('[inert]')).toBeTruthy();
      expect(
        within(sources).getByRole('button', { name: 'Quelle anzeigen: projekt.pdf' })
      ).toBeTruthy();

      await user.click(within(sources).getByRole('button', { name: 'Quellen einblenden' }));
      expect(within(sources).getByText('Alle auswählen').closest('[inert]')).toBeNull();
    });

    it('opens the text of a source from its symbol on the rail and opens the column with it', async () => {
      serveNotebook();
      server.use(
        http.get(`${base}/sources/${source().id}/text`, () =>
          HttpResponse.json({
            id: source().id,
            title: 'projekt.pdf',
            kind: SOURCE_KIND.PDF,
            sourceUrl: null,
            text: 'Dr. Brandt leitet das Projekt.',
          })
        ),
        http.get(`${base}/sources/${source().id}/overview`, () => new Promise<never>(() => {}))
      );
      renderPage();
      const user = userEvent.setup();

      const sources = await screen.findByRole('region', { name: 'Quellen' });
      await user.click(await within(sources).findByRole('button', { name: 'Quellen ausblenden' }));
      await user.click(
        within(sources).getByRole('button', { name: 'Quelle anzeigen: projekt.pdf' })
      );

      // The reader replaces the list, and the column is open again.
      expect(
        await within(sources).findByRole('button', { name: 'Quellenansicht schließen' })
      ).toBeTruthy();
      expect(within(sources).queryByText('Alle auswählen')).toBeNull();
    });
  });
});
