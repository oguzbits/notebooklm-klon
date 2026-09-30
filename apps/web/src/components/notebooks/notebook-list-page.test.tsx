import { API_ERROR } from '@nlm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { notebook } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NotebookListPage } from './notebook-list-page';

const list = (notebooks: unknown[]) =>
  http.get('*/api/notebooks', () => HttpResponse.json(notebooks));

describe('NotebookListPage', () => {
  it('shows a loading state, then the notebooks', async () => {
    server.use(list([notebook({ title: 'Steuerrecht' }), notebook({ title: 'Forschung' })]));
    renderWithProviders(<NotebookListPage />);

    expect(screen.getByRole('status', { name: 'Wird geladen' })).toBeTruthy();
    expect(await screen.findByText('Steuerrecht')).toBeTruthy();
    expect(screen.getByText('Forschung')).toBeTruthy();
  });

  it('invites the user to create the first notebook when there is none', async () => {
    server.use(list([]));
    renderWithProviders(<NotebookListPage />);

    expect(await screen.findByText('Noch kein Notizbuch')).toBeTruthy();
  });

  it('shows a German error with a retry that loads the list again', async () => {
    let failing = true;
    server.use(
      http.get('*/api/notebooks', () =>
        failing
          ? HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 })
          : HttpResponse.json([notebook({ title: 'Wieder da' })])
      )
    );
    renderWithProviders(<NotebookListPage />);

    expect(await screen.findByText(/Etwas ist schiefgelaufen/)).toBeTruthy();
    failing = false;
    await userEvent.setup().click(screen.getByRole('button', { name: /Erneut versuchen/ }));

    expect(await screen.findByText('Wieder da')).toBeTruthy();
  });

  it('creates a notebook with the typed title and reloads the list', async () => {
    let created: unknown;
    let notebooks: unknown[] = [];
    server.use(
      http.get('*/api/notebooks', () => HttpResponse.json(notebooks)),
      http.post('*/api/notebooks', async ({ request }) => {
        created = await request.json();
        notebooks = [notebook({ title: 'Neu' })];
        return HttpResponse.json(notebook({ title: 'Neu' }), { status: 201 });
      })
    );
    renderWithProviders(<NotebookListPage />);
    await screen.findByText('Noch kein Notizbuch');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Neues Notizbuch' }));
    await user.type(await screen.findByLabelText('Titel des Notizbuchs'), '  Neu ');
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByText('Neu')).toBeTruthy();
    expect(created).toEqual({ title: 'Neu' });
  });

  it('asks before deleting and deletes after the confirmation', async () => {
    let deleted = false;
    server.use(
      http.get('*/api/notebooks', () =>
        HttpResponse.json(deleted ? [] : [notebook({ title: 'Weg damit' })])
      ),
      http.delete('*/api/notebooks/:id', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderWithProviders(<NotebookListPage />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: /Weitere Aktionen für Notizbuch „Weg damit“/ })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
    expect(deleted).toBe(false);
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByText('Noch kein Notizbuch')).toBeTruthy();
  });
});
