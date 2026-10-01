import { API_ERROR } from '@nlm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { notebook, NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { CustomizeNotebookDialog } from './customize-notebook-dialog';

const url = `*/api/notebooks/${NOTEBOOK_ID}`;

function renderDialog(own: string | null = null) {
  const onOpenChange = vi.fn();
  renderWithProviders(
    <CustomizeNotebookDialog
      notebook={notebook({ title: 'Forschung', customSummary: own })}
      open
      onOpenChange={onOpenChange}
    />
  );
  return onOpenChange;
}

/** Answers the change with the notebook as the server would return it, and keeps what was sent. */
function serve() {
  const sent: unknown[] = [];
  server.use(
    http.patch(url, async ({ request }) => {
      const body = await request.json();
      sent.push(body);
      return HttpResponse.json(notebook({ title: 'Forschung' }));
    })
  );
  return sent;
}

describe('CustomizeNotebookDialog', () => {
  it('names the notebook and starts with its title and without an own summary', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: '„Forschung“ anpassen' })).toBeTruthy();
    expect((screen.getByLabelText('Titel des Notizbuchs') as HTMLInputElement).value).toBe(
      'Forschung'
    );
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'Eigene Zusammenfassung' })).toBeNull();
  });

  it('closes without a request when nothing was changed', async () => {
    const sent = serve();
    const onOpenChange = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(sent).toEqual([]);
  });

  it('sends only the title when only the title was changed', async () => {
    const sent = serve();
    const onOpenChange = renderDialog();
    const user = userEvent.setup();

    const field = screen.getByLabelText('Titel des Notizbuchs');
    await user.clear(field);
    await user.type(field, ' Neu ');
    await user.click(screen.getByRole('button', { name: 'Fertig' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sent).toEqual([{ title: 'Neu' }]);
  });

  it('sets an own summary with the switch and sends it', async () => {
    const sent = serve();
    renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('switch'));
    const done = screen.getByRole('button', { name: 'Fertig' });
    // An own summary that is empty cannot be saved.
    expect((done as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByRole('textbox', { name: 'Eigene Zusammenfassung' }), 'Mein Text');
    await user.click(done);

    await waitFor(() => expect(sent).toEqual([{ customSummary: 'Mein Text' }]));
  });

  it('takes the own summary back by switching it off', async () => {
    const sent = serve();
    renderDialog('Mein Text');
    const user = userEvent.setup();

    expect(
      (screen.getByRole('textbox', { name: 'Eigene Zusammenfassung' }) as HTMLTextAreaElement).value
    ).toBe('Mein Text');
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Fertig' }));

    await waitFor(() => expect(sent).toEqual([{ customSummary: null }]));
  });

  it('cannot save an empty title', async () => {
    renderDialog();
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText('Titel des Notizbuchs'));

    expect((screen.getByRole('button', { name: 'Fertig' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('keeps the dialog open and says so when saving failed', async () => {
    server.use(
      http.patch(url, () => HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 }))
    );
    const onOpenChange = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('switch'));
    await user.type(screen.getByRole('textbox', { name: 'Eigene Zusammenfassung' }), 'Text');
    await user.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
