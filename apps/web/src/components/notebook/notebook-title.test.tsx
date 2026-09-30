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
const field = () => screen.getByRole('textbox', { name: 'Titel des Notizbuchs' });

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

    await screen.findByRole('textbox', { name: 'Titel des Notizbuchs' });
    await vi.waitFor(() => expect(sent).toEqual({ title: 'Neu' }));
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('renames on Enter', async () => {
    let sent: unknown;
    server.use(
      http.patch(url, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(notebook({ id: NOTEBOOK_ID, title: 'Mit Enter' }));
      }),
      http.get('*/api/notebooks', () => HttpResponse.json([]))
    );
    renderTitle();
    const user = userEvent.setup();

    await user.clear(field());
    await user.type(field(), 'Mit Enter{Enter}');

    await vi.waitFor(() => expect(sent).toEqual({ title: 'Mit Enter' }));
  });

  it('takes the change back on Escape and sends nothing', async () => {
    let called = false;
    server.use(
      http.patch(url, () => {
        called = true;
        return HttpResponse.json(notebook());
      })
    );
    renderTitle();
    const user = userEvent.setup();

    await user.clear(field());
    await user.type(field(), 'Halb fertig{Escape}');

    expect(field()).toHaveProperty('value', 'Alt');
    expect(called).toBe(false);
  });

  it('does not send an empty or an unchanged title', async () => {
    let called = false;
    server.use(
      http.patch(url, () => {
        called = true;
        return HttpResponse.json(notebook());
      })
    );
    renderTitle();
    const user = userEvent.setup();

    await user.clear(field());
    await user.tab();
    expect(field()).toHaveProperty('value', 'Alt');
    await user.click(field());
    await user.tab();

    expect(called).toBe(false);
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
