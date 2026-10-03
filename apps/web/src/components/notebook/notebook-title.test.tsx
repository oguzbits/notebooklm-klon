import { API_ERROR } from '@nlm/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { notebook, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NotebookTitle } from './notebook-title';

const url = `*/api/notebooks/${NOTEBOOK_ID}`;
const field = () => screen.getByRole('textbox', { name: 'Titel des Notebooks' });

function renderTitle() {
  return renderWithProviders(
    <NotebookTitle notebook={notebook({ id: NOTEBOOK_ID, title: 'Alt' })} />
  );
}

describe('NotebookTitle', () => {
  it('renames when the field is left, and says the new title to screen readers', async () => {
    let sent: unknown;
    server.use(
      http.patch(url, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(notebook({ id: NOTEBOOK_ID, title: 'Neu' }));
      }),
      http.get('*/api/notebooks', () => HttpResponse.json([]))
    );
    renderTitle();
    const user = userEvent.setup();

    await user.clear(field());
    await user.type(field(), '  Neu  ');
    await user.tab();

    await screen.findByRole('textbox', { name: 'Titel des Notebooks' });
    await vi.waitFor(() => expect(sent).toEqual({ title: 'Neu' }));
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('shows what went wrong and puts the old title back', async () => {
    server.use(
      http.patch(url, () => HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 }))
    );
    renderTitle();
    const user = userEvent.setup();

    await user.clear(field());
    await user.type(field(), 'Neu{Enter}');

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(field()).toHaveProperty('value', 'Alt');
  });
});
