import { API_ERROR, SUBMIT_ACTION } from '@nlm/shared';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NOTEBOOK_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { AddSource } from './add-source';

afterEach(() => vi.unstubAllGlobals());

describe('AddSource', () => {
  it('sends a chosen file to the upload route and shows the reason when it is refused', async () => {
    // jsdom's FormData is not a body the Node fetch accepts, so the request is answered here.
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        requests.push(input);
        return Response.json({ code: API_ERROR.UNSUPPORTED_FILE }, { status: 415 });
      })
    );
    renderWithProviders(<AddSource notebookId={NOTEBOOK_ID} />);

    fireEvent.change(screen.getByLabelText('Datei auswählen'), {
      target: { files: [new File(['x'], 'bild.png')] },
    });

    expect(await screen.findByText(/Dateiformat wird nicht unterstützt/)).toBeTruthy();
    expect(requests).toEqual([`/api/notebooks/${NOTEBOOK_ID}/sources/file`]);
  });

  it('sends the web address and clears the field when it was accepted', async () => {
    let body: unknown;
    server.use(
      http.post(`*/api/notebooks/${NOTEBOOK_ID}/sources/url`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { sourceId: '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22', action: SUBMIT_ACTION.CREATED },
          { status: 202 }
        );
      })
    );
    renderWithProviders(<AddSource notebookId={NOTEBOOK_ID} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Oder eine Webseite'), 'https://example.test/artikel');
    await user.click(screen.getByRole('button', { name: 'Link hinzufügen' }));

    await vi.waitFor(() => expect(body).toEqual({ url: 'https://example.test/artikel' }));
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Oder eine Webseite')).toHaveProperty('value', '')
    );
  });

  it('shows why an address was refused', async () => {
    server.use(
      http.post(`*/api/notebooks/${NOTEBOOK_ID}/sources/url`, () =>
        HttpResponse.json({ code: API_ERROR.INVALID_URL }, { status: 400 })
      )
    );
    renderWithProviders(<AddSource notebookId={NOTEBOOK_ID} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Oder eine Webseite'), 'http://intern.example/');
    await user.click(screen.getByRole('button', { name: 'Link hinzufügen' }));

    expect(await screen.findByText(/Diese Adresse kann nicht geladen werden/)).toBeTruthy();
  });
});
