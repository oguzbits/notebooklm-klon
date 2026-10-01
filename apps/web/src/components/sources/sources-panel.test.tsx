import { API_ERROR, SOURCE_FAILURE, SOURCE_STATUS } from '@nlm/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { NOTEBOOK_ID, source, SOURCE_ID } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { SourcesPanel } from './sources-panel';

const base = `*/api/notebooks/${NOTEBOOK_ID}/sources`;
const list = (sources: unknown[]) => http.get(base, () => HttpResponse.json(sources));

function renderPanel(onOpenSource: (sourceId: string) => void = () => {}) {
  return renderWithProviders(<SourcesPanel notebookId={NOTEBOOK_ID} onOpenSource={onOpenSource} />);
}

describe('SourcesPanel', () => {
  it('renames a source from its menu', async () => {
    let sent: unknown;
    server.use(
      list([source({ id: SOURCE_ID, title: 'alt.pdf' })]),
      http.patch(`${base}/${SOURCE_ID}/title`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ title: 'Neu' });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Weitere Aktionen für „alt.pdf“/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quelle umbenennen' }));
    const field = await screen.findByLabelText('Name der Quelle');
    await user.clear(field);
    await user.type(field, ' Neu ');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => expect(sent).toEqual({ title: 'Neu' }));
    await vi.waitFor(() => expect(screen.queryByLabelText('Name der Quelle')).toBeNull());
  });

  it('does not save an empty name', async () => {
    server.use(list([source({ id: SOURCE_ID, title: 'alt.pdf' })]));
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Weitere Aktionen für „alt.pdf“/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quelle umbenennen' }));
    await user.clear(await screen.findByLabelText('Name der Quelle'));

    expect((screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('sorts the sources by the choice in the menu', async () => {
    server.use(
      list([
        source({ id: SOURCE_ID, title: 'zebra.pdf' }),
        source({ id: '7c3a0e4b-9d56-4b8f-9e27-4c0a8d3b5e69', title: 'adler.pdf' }),
      ])
    );
    renderPanel();
    const user = userEvent.setup();
    const titles = () =>
      screen.getAllByRole('button', { name: /\.pdf$/ }).map((button) => button.textContent);
    await screen.findByText('zebra.pdf');
    expect(titles()).toEqual(['PDFzebra.pdf', 'PDFadler.pdf']);

    await user.click(screen.getByRole('button', { name: 'Quellen sortieren' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Titel' }));

    expect(titles()).toEqual(['PDFadler.pdf', 'PDFzebra.pdf']);
  });

  it('explains what to do when there is no source yet', async () => {
    server.use(list([]));
    renderPanel();

    expect(await screen.findByText('Noch keine Quellen')).toBeTruthy();
  });

  it('shows the state of each source in plain German', async () => {
    server.use(
      list([
        source({ id: SOURCE_ID, title: 'fertig.pdf' }),
        source({
          id: '7c3a0e4b-9d56-4b8f-9e27-4c0a8d3b5e69',
          title: 'laeuft.docx',
          status: SOURCE_STATUS.PROCESSING,
        }),
        source({
          id: '8d4b1f5c-ae67-4c90-8f38-5d1b9e4c6f7a',
          title: 'kaputt.pdf',
          status: SOURCE_STATUS.FAILED,
          failure: SOURCE_FAILURE.EMPTY_TEXT,
        }),
      ])
    );
    renderPanel();

    expect(await screen.findByText('fertig.pdf')).toBeTruthy();
    expect(screen.getByText('Wird gelesen …')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'In dieser Quelle wurde kein Text gefunden.'
    );
    expect(screen.getByRole('checkbox', { name: /„laeuft.docx“/ })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('opens the text of a ready source', async () => {
    server.use(list([source({ title: 'fertig.pdf' })]));
    const onOpen = vi.fn();
    renderPanel(onOpen);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'fertig.pdf' }));

    expect(onOpen).toHaveBeenCalledWith(SOURCE_ID);
  });

  it('sends the new selection when a source is unticked', async () => {
    let body: unknown;
    server.use(
      list([source({ title: 'fertig.pdf' })]),
      http.patch(`${base}/${SOURCE_ID}`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ selected: false });
      })
    );
    renderPanel();

    await userEvent.setup().click(await screen.findByRole('checkbox', { name: /„fertig.pdf“/ }));

    await vi.waitFor(() => expect(body).toEqual({ selected: false }));
  });

  it('shows a retry when the list cannot be loaded', async () => {
    server.use(
      http.get(base, () => HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 }))
    );
    renderPanel();

    expect(await screen.findByRole('button', { name: /Erneut versuchen/ })).toBeTruthy();
  });
});
