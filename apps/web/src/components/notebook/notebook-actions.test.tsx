import { DEFAULT_CHAT_CONFIG } from '@nlm/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { notebook, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NotebookActions } from './notebook-actions';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;

/** Stands in for the notebook page: the notebook of the test shows its actions, any other one says so. */
function Page() {
  const { notebookId } = useParams();
  return notebookId === NOTEBOOK_ID ? (
    <NotebookActions notebook={notebook({ id: NOTEBOOK_ID, title: 'Forschung' })} />
  ) : (
    <p>Neues Notizbuch offen</p>
  );
}

function renderActions() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<p>Liste</p>} />
      <Route path="/notizbuecher/:notebookId" element={<Page />} />
    </Routes>,
    `/notizbuecher/${NOTEBOOK_ID}`
  );
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Notizbuch-Konfiguration' }));

describe('NotebookActions', () => {
  it('opens the chat settings from the menu', async () => {
    server.use(http.get(`${base}/chat-config`, () => HttpResponse.json(DEFAULT_CHAT_CONFIG)));
    renderActions();
    const user = userEvent.setup();

    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /Chat konfigurieren/ }));

    expect(await screen.findByRole('dialog', { name: 'Chat konfigurieren' })).toBeTruthy();
  });

  it('deletes the chat history only after asking', async () => {
    const removed = vi.fn();
    server.use(
      http.delete(`${base}/messages`, () => {
        removed();
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderActions();
    const user = userEvent.setup();

    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: /Chatverlauf löschen/ }));
    expect(removed).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Löschen' }));

    await vi.waitFor(() => expect(removed).toHaveBeenCalledOnce());
  });

  it('deletes the notebook after asking and goes back to the list', async () => {
    server.use(
      http.delete(base, () => new HttpResponse(null, { status: 204 })),
      http.get('*/api/notebooks', () => HttpResponse.json([]))
    );
    renderActions();
    const user = userEvent.setup();

    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Notizbuch löschen' }));
    await user.click(await screen.findByRole('button', { name: 'Löschen' }));

    expect(await screen.findByText('Liste')).toBeTruthy();
  });

  it('keeps the notebook when the question is answered with cancel', async () => {
    renderActions();
    const user = userEvent.setup();

    await openMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Notizbuch löschen' }));
    await user.click(await screen.findByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByText('Liste')).toBeNull();
  });

  it('makes a new notebook and opens it', async () => {
    server.use(
      http.post('*/api/notebooks', () =>
        HttpResponse.json(notebook({ id: '22222222-2222-4222-8222-222222222222', title: 'Neu' }), {
          status: 201,
        })
      ),
      http.get('*/api/notebooks', () => HttpResponse.json([]))
    );
    renderActions();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Notizbuch erstellen/ }));
    await user.type(await screen.findByLabelText('Titel des Notizbuchs'), 'Neu');
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByText('Neues Notizbuch offen')).toBeTruthy();
  });
});
