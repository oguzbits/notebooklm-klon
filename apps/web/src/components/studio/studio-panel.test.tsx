import { API_ERROR, REPORT_FORMAT, STUDIO_KIND, type StudioOutput } from '@nlm/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { flashcardsOutput, NOTEBOOK_ID, OUTPUT_ID, quizOutput, source } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { StudioPanel } from './studio-panel';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;

/** The handlers every test needs: the sources, the notes and the list of outputs. */
function serve(options: { outputs?: unknown[]; sources?: unknown[] } = {}) {
  server.use(
    http.get(`${base}/sources`, () => HttpResponse.json(options.sources ?? [source()])),
    http.get(`${base}/notes`, () => HttpResponse.json([])),
    http.get(`${base}/studio`, () => HttpResponse.json(options.outputs ?? []))
  );
}

/** A Studio that keeps what it makes: the list holds the output once it was created. */
function serveMaking(
  output: StudioOutput,
  onCreate: (body: unknown) => Promise<void> | void = () => {}
) {
  let made = false;
  server.use(
    http.get(`${base}/studio`, () => HttpResponse.json(made ? [output] : [])),
    http.post(`${base}/studio`, async ({ request }) => {
      await onCreate(await request.json());
      made = true;
      return HttpResponse.json(output, { status: 201 });
    })
  );
}

function renderPanel(onOpenCitation: (chunkId: string) => void = () => {}) {
  return renderWithProviders(
    <StudioPanel notebookId={NOTEBOOK_ID} onOpenCitation={onOpenCitation} />
  );
}

describe('StudioPanel', () => {
  it('says what appears here while nothing has been made', async () => {
    serve();
    renderPanel();

    expect(await screen.findByText(/Hier erscheinen deine Berichte/)).toBeTruthy();
    expect(screen.getByText('Noch keine Notizen')).toBeTruthy();
  });

  it('tells what a tile makes when the pointer rests on it', async () => {
    serve();
    renderPanel();
    const user = userEvent.setup();

    await user.hover(await screen.findByRole('button', { name: 'Quiz' }));

    expect(
      (await screen.findAllByText(/Interaktives Quiz auf Grundlage deiner Quellen/)).length
    ).toBeGreaterThan(0);
  });

  it('keeps the tooltip of a tile that cannot be used yet', async () => {
    serve({ sources: [] });
    renderPanel();
    const user = userEvent.setup();

    const tile = await screen.findByRole('button', { name: 'Mindmap' });
    expect(tile).toHaveProperty('disabled', true);
    await user.hover(tile.parentElement as HTMLElement);

    expect(
      (await screen.findAllByText(/Mindmap mithilfe von KI erstellen/)).length
    ).toBeGreaterThan(0);
  });

  it('lists the outputs with what they are', async () => {
    serve({ outputs: [flashcardsOutput()] });
    renderPanel();

    expect(await screen.findByText(/Karteikarten · 2 Karten · /)).toBeTruthy();
  });

  it('makes flashcards, shows that it works and opens them when they are ready', async () => {
    let body: unknown;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    serve();
    serveMaking(flashcardsOutput(), async (sent) => {
      body = sent;
      await gate;
    });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Karteikarten' }));

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      expect.stringContaining('Karteikarten wird erstellt')
    );
    expect(screen.getByRole('button', { name: 'Quiz' })).toHaveProperty('disabled', true);
    release();
    expect(await screen.findByText('Karte 1 von 2')).toBeTruthy();
    expect(body).toEqual({ kind: STUDIO_KIND.FLASHCARDS });
  });

  it('asks for the format when a report is made', async () => {
    let body: unknown;
    serve();
    serveMaking(quizOutput(), (sent) => {
      body = sent;
    });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Bericht' }));
    await user.click(await screen.findByRole('radio', { name: /Häufige Fragen/ }));
    await user.click(screen.getByRole('button', { name: 'Generieren' }));

    await screen.findByText('Frage 1 von 1');
    expect(body).toEqual({ kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ });
  });

  it('cannot make anything without a ready, selected source', async () => {
    serve({ sources: [source({ selected: false })] });
    renderPanel();

    expect(await screen.findByText(/Wähle mindestens eine fertig gelesene Quelle/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quiz' })).toHaveProperty('disabled', true);
  });

  it('explains a failure and offers to try again', async () => {
    serve();
    let attempts = 0;
    let made = false;
    server.use(
      http.get(`${base}/studio`, () => HttpResponse.json(made ? [flashcardsOutput()] : [])),
      http.post(`${base}/studio`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ code: API_ERROR.STUDIO_EMPTY }, { status: 422 });
        }
        made = true;
        return HttpResponse.json(flashcardsOutput(), { status: 201 });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Karteikarten' }));
    expect(await screen.findByText(/nichts Belegbares erstellen/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Erneut versuchen/ }));

    expect(await screen.findByText('Karte 1 von 2')).toBeTruthy();
  });

  it('opens an output from the list, goes back and deletes it', async () => {
    let deleted = false;
    serve({ outputs: [flashcardsOutput()] });
    server.use(
      http.get(`${base}/studio`, () => HttpResponse.json(deleted ? [] : [flashcardsOutput()])),
      http.delete(`${base}/studio/${OUTPUT_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Karteikarten · 2 Karten/ }));
    await user.click(await screen.findByRole('button', { name: 'Zurück zum Studio' }));
    const list = screen.getByRole('region', { name: 'Erstellte Ausgaben' });
    await user.click(
      within(list).getByRole('button', { name: 'Weitere Aktionen für „Karteikarten“' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));

    expect(await screen.findByText(/Hier erscheinen deine Berichte/)).toBeTruthy();
  });
});
