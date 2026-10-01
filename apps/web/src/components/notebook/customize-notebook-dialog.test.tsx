import { API_ERROR } from '@nlm/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('the cover image in the dialog', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** jsdom's FormData is not a body the Node fetch accepts, so the requests are answered here. */
  function stubCover(coverImage: boolean) {
    const requests: { url: string; method: string; file?: File }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string, init?: { method?: string; body?: FormData }) => {
        const method = init?.method ?? 'GET';
        if (input.endsWith('/api/capabilities')) {
          return Response.json({ webSearch: false, coverImage });
        }
        requests.push({ url: input, method, file: init?.body?.get('file') as File | undefined });
        if (method === 'DELETE') return new Response(null, { status: 204 });
        return Response.json(notebook({ coverVersion: COVER_VERSION }));
      })
    );
    return requests;
  }

  const COVER_VERSION = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
  const renderWithCover = (coverVersion: string | null) =>
    renderWithProviders(
      <CustomizeNotebookDialog
        notebook={notebook({ title: 'Forschung', coverVersion })}
        open
        onOpenChange={() => {}}
      />
    );

  it('is not offered where no object store is set up', async () => {
    stubCover(false);
    renderWithCover(null);

    await screen.findByRole('heading', { name: '„Forschung“ anpassen' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: 'Hochladen' })).toBeNull();
  });

  it('sends the chosen image to the cover route', async () => {
    const requests = stubCover(true);
    renderWithCover(null);
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'titel.png', {
      type: 'image/png',
    });

    await screen.findByRole('button', { name: 'Hochladen' });
    fireEvent.change(screen.getByLabelText('Titelbild auswählen'), { target: { files: [file] } });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      url: `/api/notebooks/${NOTEBOOK_ID}/cover`,
      method: 'PUT',
    });
    expect(requests[0]?.file?.name).toBe('titel.png');
  });

  it('shows the image and takes it back', async () => {
    const requests = stubCover(true);
    renderWithCover(COVER_VERSION);
    const user = userEvent.setup();

    expect((await screen.findByRole('img', { name: 'Titelbild' })).getAttribute('src')).toBe(
      `/api/notebooks/${NOTEBOOK_ID}/cover?v=${COVER_VERSION}`
    );
    await user.click(await screen.findByRole('button', { name: 'Titelbild entfernen' }));

    await waitFor(() => expect(requests.map((r) => r.method)).toEqual(['DELETE']));
  });

  it('says why an image was refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input.endsWith('/api/capabilities')
          ? Response.json({ webSearch: false, coverImage: true })
          : Response.json({ code: API_ERROR.COVER_INVALID }, { status: 400 })
      )
    );
    renderWithCover(null);

    await screen.findByRole('button', { name: 'Hochladen' });
    fireEvent.change(screen.getByLabelText('Titelbild auswählen'), {
      target: { files: [new File(['x'], 'seite.html')] },
    });

    expect(await screen.findByText(/PNG, JPEG oder WebP/)).toBeTruthy();
  });
});
