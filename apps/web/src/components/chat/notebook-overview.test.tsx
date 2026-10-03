import { API_ERROR, NOTE_KIND, SOURCE_STATUS, type SourceSummary } from '@nlm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { notebook, NOTEBOOK_ID, source } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NotebookOverview } from './notebook-overview';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;
const SUMMARY = 'Die Quellen beschreiben **Jev**, ein Modell für **typisierte Werte**.';
const READY = [source()];
const SECOND_ID = '99999999-9999-4999-8999-999999999999';

interface Served {
  overviews: number;
  notes: unknown[];
}

/** The notebook, its sources and the overview, counting what the page asks for. */
function serve(
  options: {
    notebooks?: unknown[];
    reply?: (call: number) => Response | Promise<Response>;
  } = {}
): Served {
  const served: Served = { overviews: 0, notes: [] };
  server.use(
    http.get('*/api/notebooks', () =>
      HttpResponse.json(
        options.notebooks ?? [notebook({ title: 'Jev: ein Modell', sourceCount: 2 })]
      )
    ),
    http.get(`${base}/overview`, () => {
      served.overviews += 1;
      return (
        options.reply?.(served.overviews) ??
        HttpResponse.json({ overview: { emoji: '🤖', summary: SUMMARY } })
      );
    }),
    http.post(`${base}/notes`, async ({ request }) => {
      served.notes.push(await request.json());
      return HttpResponse.json(
        {
          id: '4c2d7e9f-2a58-4b1c-9d34-6e8f0a1b2c33',
          kind: NOTE_KIND.WRITTEN,
          title: 'Zusammenfassung',
          body: SUMMARY,
          createdAt: '2026-09-30T12:00:00.000Z',
        },
        { status: 201 }
      );
    })
  );
  return served;
}

const onCustomize = vi.fn();
const renderOverview = (sources: SourceSummary[] = READY) =>
  renderWithProviders(
    <NotebookOverview notebookId={NOTEBOOK_ID} sources={sources} onCustomize={onCustomize} />
  );

describe('NotebookOverview', () => {
  it('shows the cover and the summary with its key terms in bold', async () => {
    serve();
    renderOverview();

    expect(await screen.findByRole('heading', { name: 'Jev: ein Modell' })).toBeTruthy();
    expect(screen.getByText('🤖')).toBeTruthy();
    expect(screen.getByText(/^2 Quellen · \d{2}\.\d{2}\.\d{4}$/)).toBeTruthy();
    expect((await screen.findByText('Jev')).tagName).toBe('STRONG');
    expect(screen.getByText('typisierte Werte').tagName).toBe('STRONG');
  });

  it('shows the cover image of the notebook instead of the symbol', async () => {
    const version = '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22';
    serve();
    server.use(
      http.get('*/api/notebooks', () =>
        HttpResponse.json([notebook({ title: 'Jev: ein Modell', coverVersion: version })])
      )
    );
    const { container } = renderOverview();

    await screen.findByRole('heading', { name: 'Jev: ein Modell' });
    await waitFor(() =>
      expect(container.querySelector('img')?.getAttribute('src')).toBe(
        `/api/notebooks/${NOTEBOOK_ID}/cover?v=${version}`
      )
    );
    expect(screen.queryByText('🤖')).toBeNull();
  });

  it('opens the customizing of the notebook when the cover is clicked', async () => {
    serve();
    renderOverview();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Notebook anpassen' }));

    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it('shows the cover at once and a placeholder in place of the summary while it is made', async () => {
    serve({
      reply: async () => (
        await delay(150),
        HttpResponse.json({ overview: { emoji: '🤖', summary: SUMMARY } })
      ),
    });
    renderOverview();

    expect(await screen.findByRole('heading', { name: 'Jev: ein Modell' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Wird geladen' })).toBeTruthy();
    expect(await screen.findByText('Jev')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Wird geladen' })).toBeNull();
  });

  it('shows nothing, and asks for nothing, while no source is ready', () => {
    const served = serve();
    renderOverview([source({ status: SOURCE_STATUS.FAILED })]);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(served.overviews).toBe(0);
  });

  it('waits until every source is read before it asks, so one upload makes one overview', async () => {
    const served = serve();
    renderOverview([source(), source({ id: SECOND_ID, status: SOURCE_STATUS.PROCESSING })]);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(served.overviews).toBe(0);
  });

  it('asks again when a source was added, and keeps the old summary until the new one is there', async () => {
    const served = serve({
      reply: async (call) => {
        if (call === 2) await delay(150);
        return HttpResponse.json({
          overview: { emoji: '🤖', summary: call === 1 ? SUMMARY : 'Jetzt mit **Budget**.' },
        });
      },
    });
    function Harness() {
      const [list, setList] = useState<SourceSummary[]>(READY);
      return (
        <>
          <button type="button" onClick={() => setList([...READY, source({ id: SECOND_ID })])}>
            Quelle dazu
          </button>
          <NotebookOverview notebookId={NOTEBOOK_ID} sources={list} onCustomize={() => {}} />
        </>
      );
    }
    renderWithProviders(<Harness />);
    await screen.findByText('Jev');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Quelle dazu' }));

    expect(screen.getByText('Jev')).toBeTruthy();
    expect(await screen.findByText('Budget')).toBeTruthy();
    expect(served.overviews).toBe(2);
    expect(screen.queryByText('Jev')).toBeNull();
  });

  it('says why there is no summary and tries again on request, the cover stays', async () => {
    const served = serve({
      reply: (call) =>
        call === 1
          ? HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 })
          : HttpResponse.json({ overview: { emoji: '🤖', summary: SUMMARY } }),
    });
    renderOverview();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Jev: ein Modell' })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('Jev')).toBeTruthy();
    expect(served.overviews).toBe(2);
  });

  it('saves the summary as a note of your own, with the bold terms as Markdown', async () => {
    const served = serve();
    renderOverview();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'In Notiz speichern' }));

    expect(await screen.findByText('In Notiz gespeichert')).toBeTruthy();
    expect(served.notes).toEqual([
      { kind: NOTE_KIND.WRITTEN, title: 'Zusammenfassung', body: SUMMARY },
    ]);
  });

  it('copies the summary as plain text, without the marks of the bold terms', async () => {
    serve();
    renderOverview();
    // user-event puts its own clipboard in place when it is set up, so it comes first.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(await screen.findByRole('button', { name: 'Zusammenfassung kopieren' }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Die Quellen beschreiben Jev, ein Modell für typisierte Werte.'
      )
    );
  });

  it('shows the symbol of the notebook until the overview has chosen one', async () => {
    serve({
      notebooks: [notebook({ title: 'Jev: ein Modell', emoji: '🔬' })],
      reply: async () => (
        await delay(200),
        HttpResponse.json({ overview: { emoji: '🤖', summary: SUMMARY } })
      ),
    });
    renderOverview();

    expect(await screen.findByText('🔬')).toBeTruthy();
    await screen.findByText('Jev');
    expect(screen.getByText('🤖')).toBeTruthy();
    expect(screen.queryByText('🔬')).toBeNull();
  });
});
