import { API_ERROR } from '@nlm/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { UNTITLED_NOTEBOOK } from '@/components/notebooks/create-notebook-button';
import { notebookEmoji } from '@/lib/notebook-emoji';
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

  it('makes an untitled notebook at once, without asking for a title', async () => {
    let created: unknown;
    server.use(
      http.get('*/api/notebooks', () => HttpResponse.json([])),
      http.post('*/api/notebooks', async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(notebook({ title: UNTITLED_NOTEBOOK }), { status: 201 });
      })
    );
    renderWithProviders(<NotebookListPage />);
    await screen.findByText('Noch kein Notizbuch');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Neues Notebook' }));

    await waitFor(() => expect(created).toEqual({ title: UNTITLED_NOTEBOOK }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tells why no notebook was made and tries again on request', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/notebooks', () => HttpResponse.json([])),
      http.post('*/api/notebooks', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 })
          : HttpResponse.json(notebook({ title: UNTITLED_NOTEBOOK }), { status: 201 });
      })
    );
    renderWithProviders(<NotebookListPage />);
    await screen.findByText('Noch kein Notizbuch');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Neues Notebook' }));
    expect(await screen.findByText('Notebook konnte nicht erstellt werden')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() => expect(calls).toBe(2));
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

  it('changes the title from the menu of a card', async () => {
    let sent: unknown;
    server.use(
      list([notebook({ title: 'Alt' })]),
      http.patch('*/api/notebooks/:id', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(notebook({ title: 'Neu' }));
      })
    );
    renderWithProviders(<NotebookListPage />);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: /Weitere Aktionen für Notizbuch „Alt“/ })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Titel bearbeiten' }));
    const field = await screen.findByLabelText('Titel des Notizbuchs');
    await user.clear(field);
    await user.type(field, 'Neu');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => expect(sent).toEqual({ title: 'Neu' }));
  });

  it('pins a notebook, and offers to take the pin back once it is pinned', async () => {
    const sent: unknown[] = [];
    let pinned = false;
    server.use(
      http.get('*/api/notebooks', () =>
        HttpResponse.json([notebook({ title: 'Wichtig', pinned })])
      ),
      http.patch('*/api/notebooks/:id', async ({ request }) => {
        sent.push(await request.json());
        pinned = !pinned;
        return HttpResponse.json(notebook({ title: 'Wichtig', pinned }));
      })
    );
    renderWithProviders(<NotebookListPage />);
    const user = userEvent.setup();
    const open = async () =>
      user.click(await screen.findByRole('button', { name: /Weitere Aktionen für Notizbuch/ }));

    await open();
    await user.click(await screen.findByRole('menuitem', { name: 'Oben anpinnen' }));
    await open();
    await user.click(await screen.findByRole('menuitem', { name: 'Nicht mehr oben anpinnen' }));

    expect(sent).toEqual([{ pinned: true }, { pinned: false }]);
  });

  it('shows the date and the number of sources on each card', async () => {
    server.use(
      list([
        notebook({ title: 'Mit zwei', sourceCount: 2 }),
        notebook({
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Mit einer',
          sourceCount: 1,
        }),
      ])
    );
    renderWithProviders(<NotebookListPage />);

    expect(await screen.findByText(/2 Quellen/)).toBeTruthy();
    expect(screen.getByText(/· 1 Quelle$/)).toBeTruthy();
    expect(screen.getAllByText(/^\d{2}\.\d{2}\.\d{4} ·/).length).toBe(2);
  });

  it('shows the symbol the notebook chose, and one derived from its ID until it has one', async () => {
    server.use(
      list([
        notebook({ title: 'Mit Symbol', emoji: '🔬' }),
        notebook({
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Ohne Symbol',
          emoji: null,
        }),
      ])
    );
    renderWithProviders(<NotebookListPage />);

    const cards = await screen.findAllByRole('link', { name: /Quellen/ });

    expect(cards[0]?.textContent).toContain('🔬');
    expect(cards[1]?.textContent).toContain(notebookEmoji('22222222-2222-4222-8222-222222222222'));
  });

  it('narrows the list as the user types in the search and says when nothing is left', async () => {
    server.use(
      list([
        notebook({ title: 'Steuerrecht' }),
        notebook({ id: '22222222-2222-4222-8222-222222222222', title: 'Forschung' }),
      ])
    );
    renderWithProviders(<NotebookListPage />);
    const user = userEvent.setup();
    await screen.findByText('Steuerrecht');

    await user.type(screen.getByRole('searchbox', { name: 'Notizbücher durchsuchen' }), 'forsch');
    expect(screen.queryByText('Steuerrecht')).toBeNull();
    expect(screen.getByText('Forschung')).toBeTruthy();

    await user.type(screen.getByRole('searchbox'), 'xyz');
    expect(await screen.findByText('Kein Notizbuch gefunden')).toBeTruthy();
  });
});
