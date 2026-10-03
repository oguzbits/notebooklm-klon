import {
  API_ERROR,
  NOTE_KIND,
  REPORT_FORMAT,
  STUDIO_DIFFICULTY,
  STUDIO_KIND,
  STUDIO_SIZE,
  type StudioOutput,
  SUBMIT_ACTION,
} from '@nlm/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  CHUNK_ID,
  flashcardsOutput,
  note,
  NOTE_ID,
  NOTEBOOK_ID,
  OUTPUT_ID,
  quizOutput,
  source,
  writtenNote,
} from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { StudioPanel } from './studio-panel';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;

/** The handlers every test needs: the sources, the notes and the list of outputs. */
function serve(options: { outputs?: unknown[]; sources?: unknown[]; notes?: unknown[] } = {}) {
  server.use(
    http.get(`${base}/sources`, () => HttpResponse.json(options.sources ?? [source()])),
    http.get(`${base}/notes`, () => HttpResponse.json(options.notes ?? [])),
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
    <StudioPanel
      notebookId={NOTEBOOK_ID}
      collapsed={false}
      onToggle={() => {}}
      onExpand={() => {}}
      onOpenCitation={onOpenCitation}
      onAsk={() => {}}
    />
  );
}

/** The row of an output or note in the list, found by what it says (the tiles above have names too). */
const row = (name: RegExp) =>
  within(screen.getByRole('region', { name: 'Erstellte Ausgaben' })).getByRole('button', { name });
const waitForRow = async (name: RegExp) =>
  within(await screen.findByRole('region', { name: 'Erstellte Ausgaben' })).findByRole('button', {
    name,
  });

describe('StudioPanel', () => {
  it('says what appears here while nothing has been made', async () => {
    serve();
    renderPanel();

    expect(await screen.findByText('Hier wird die Ausgabe von Studio gespeichert.')).toBeTruthy();
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
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

    // A row says how many sources it was made from and when, like "2 Quellen · Vor 1 Min.".
    expect(await screen.findByText(/^1 Quelle · /)).toBeTruthy();
  });

  it('shows a blue dot on an output nobody opened and clears it when it is opened', async () => {
    let unread = true;
    serve({ outputs: [flashcardsOutput()] });
    server.use(
      http.get(`${base}/studio`, () => HttpResponse.json([{ ...flashcardsOutput(), unread }])),
      http.patch(`${base}/studio/${OUTPUT_ID}`, async ({ request }) => {
        expect(await request.json()).toEqual({ read: true });
        unread = false;
        return HttpResponse.json({ ...flashcardsOutput(), unread });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    const unopened = await screen.findByRole('button', { name: /^Ungelesen: Karteikarten/ });
    await user.click(unopened);

    await user.click(await screen.findByRole('button', { name: 'Zurück zum Studio' }));
    expect(await screen.findByRole('button', { name: /^Karteikarten, 1 Quelle/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Ungelesen:/ })).toBeNull();
  });

  it('makes flashcards, shows that it works and adds them to the list when they are ready', async () => {
    let body: unknown;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    serve();
    serveMaking({ ...flashcardsOutput(), unread: true }, async (sent) => {
      body = sent;
      await gate;
    });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Karteikarten' }));
    await user.click(await screen.findByRole('button', { name: 'Generieren' }));

    expect(await screen.findByRole('status')).toHaveProperty(
      'textContent',
      expect.stringContaining('Karteikarten wird erstellt')
    );
    expect(screen.getByRole('button', { name: 'Quiz' })).toHaveProperty('disabled', true);
    release();
    // The result joins the list with a dot; it is not opened for the reader.
    expect(await screen.findByRole('button', { name: /^Ungelesen: Karteikarten/ })).toBeTruthy();
    expect(screen.queryByText('Karte 1 von 2')).toBeNull();
    expect(body).toEqual({
      kind: STUDIO_KIND.FLASHCARDS,
      size: STUDIO_SIZE.DEFAULT,
      difficulty: STUDIO_DIFFICULTY.MEDIUM,
    });
  });

  it('asks for the template when a report is made', async () => {
    let body: unknown;
    serve();
    serveMaking(quizOutput(), (sent) => {
      body = sent;
    });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Berichte' }));
    await user.click(await screen.findByRole('radio', { name: /Häufige Fragen/ }));
    await user.click(screen.getByRole('button', { name: 'Generieren' }));

    await waitForRow(/^Quiz/);
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
    await user.click(await screen.findByRole('button', { name: 'Generieren' }));
    expect(await screen.findByText(/nichts Belegbares erstellen/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Erneut versuchen/ }));

    expect(await screen.findByRole('button', { name: /^Karteikarten, 1 Quelle/ })).toBeTruthy();
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

    await user.click(await waitForRow(/^Karteikarten/));
    await user.click(await screen.findByRole('button', { name: 'Zurück zum Studio' }));
    const list = screen.getByRole('region', { name: 'Erstellte Ausgaben' });
    await user.click(
      within(list).getByRole('button', { name: 'Weitere Aktionen für „Karteikarten“' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Löschen' })
    );

    expect(await screen.findByText('Hier wird die Ausgabe von Studio gespeichert.')).toBeTruthy();
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('renames an output from the menu of the list', async () => {
    let sent: unknown;
    serve({ outputs: [flashcardsOutput()] });
    server.use(
      http.patch(`${base}/studio/${OUTPUT_ID}`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...flashcardsOutput(), title: 'Mein Name' });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await waitForRow(/^Karteikarten/));
    await user.click(await screen.findByRole('button', { name: 'Zurück zum Studio' }));
    const list = screen.getByRole('region', { name: 'Erstellte Ausgaben' });
    await user.click(
      within(list).getByRole('button', { name: 'Weitere Aktionen für „Karteikarten“' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Umbenennen' }));
    const field = await screen.findByLabelText('Name');
    await user.clear(field);
    await user.type(field, 'Mein Name');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    await vi.waitFor(() => expect(sent).toEqual({ title: 'Mein Name' }));
    expect(await within(list).findByRole('button', { name: /^Mein Name/ })).toBeTruthy();
  });

  it('asks before an output is deleted and keeps it when the question is declined', async () => {
    let deleted = false;
    serve({ outputs: [flashcardsOutput()] });
    server.use(
      http.delete(`${base}/studio/${OUTPUT_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await waitForRow(/^Karteikarten/));
    await user.click(await screen.findByRole('button', { name: 'Zurück zum Studio' }));
    const list = screen.getByRole('region', { name: 'Erstellte Ausgaben' });
    await user.click(
      within(list).getByRole('button', { name: 'Weitere Aktionen für „Karteikarten“' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/„Karteikarten“ wird gelöscht/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deleted).toBe(false);
    expect(within(list).getByRole('button', { name: /^Karteikarten/ })).toBeTruthy();
  });

  it('deletes an output from inside its view and returns to the list', async () => {
    let deleted = false;
    serve();
    server.use(
      http.get(`${base}/studio`, () => HttpResponse.json(deleted ? [] : [flashcardsOutput()])),
      http.delete(`${base}/studio/${OUTPUT_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderPanel();
    const user = userEvent.setup();

    await user.click(await waitForRow(/^Karteikarten/));
    await user.click(await screen.findByRole('button', { name: 'Weitere Aktionen' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Löschen' })
    );

    expect(await screen.findByText('Hier wird die Ausgabe von Studio gespeichert.')).toBeTruthy();
    await vi.waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('writes the path of an open output into the header and closes it with the button there', async () => {
    serve({ outputs: [flashcardsOutput()] });
    renderPanel();
    const user = userEvent.setup();

    await user.click(await waitForRow(/^Karteikarten/));

    const path = screen.getByRole('navigation', { name: 'Pfad' });
    expect(path.textContent).toContain('Studio');
    expect(path.textContent).toContain('Karteikarten');
    // The fold button gives way to the one that closes the view.
    expect(screen.queryByRole('button', { name: 'Studio ausblenden' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Karteikartenansicht schließen' }));
    expect(await waitForRow(/^Karteikarten/)).toBeTruthy();
  });

  it('tells the page at once that something is open, so the column can grow while it renders', async () => {
    serve({ outputs: [flashcardsOutput()] });
    const onViewingChange = vi.fn();
    renderWithProviders(
      <StudioPanel
        notebookId={NOTEBOOK_ID}
        collapsed={false}
        onToggle={() => {}}
        onExpand={() => {}}
        onOpenCitation={() => {}}
        onAsk={() => {}}
        onViewingChange={onViewingChange}
      />
    );

    await userEvent.setup().click(await waitForRow(/^Karteikarten/));

    expect(onViewingChange).toHaveBeenCalledWith(true);
  });

  describe('notes', () => {
    it('lists a saved answer between the outputs, newest first', async () => {
      serve({
        outputs: [flashcardsOutput()],
        notes: [note({ createdAt: '2026-10-01T12:00:00.000Z' })],
      });
      renderPanel();

      const rows = await screen.findAllByRole('listitem');

      expect(rows).toHaveLength(2);
      expect(rows[0]?.textContent).toContain('Dr. Brandt leitet es.');
      expect(rows[1]?.textContent).toContain('Karteikarten');
    });

    it('opens a note with a chip that leads to the cited passage', async () => {
      serve({ notes: [note()] });
      const onOpen = vi.fn();
      renderPanel(onOpen);
      const user = userEvent.setup();

      await user.click(await waitForRow(/^Dr\. Brandt leitet es\./));
      await user.click(await screen.findByRole('button', { name: 'Quelle 1 anzeigen' }));

      expect(onOpen).toHaveBeenCalledWith(CHUNK_ID);
      await user.click(screen.getByRole('button', { name: 'Zurück zum Studio' }));
      expect(await waitForRow(/^Dr\. Brandt leitet es\./)).toBeTruthy();
    });

    it('puts the text of a note among the sources as a text file', async () => {
      serve({ notes: [note()] });
      const uploads: File[] = [];
      const realFetch = globalThis.fetch;
      // Only the upload is answered here (jsdom's FormData is no body for Node's fetch).
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
          if (!String(input).endsWith('/sources/file')) return realFetch(input, init);
          uploads.push((init?.body as FormData).get('file') as File);
          return Response.json(
            { sourceId: '9b2c7d6e-1f43-4c8a-8a3b-5e7a8f0c1d22', action: SUBMIT_ACTION.CREATED },
            { status: 202 }
          );
        })
      );
      renderPanel();
      const user = userEvent.setup();

      await user.click(await waitForRow(/^Dr\. Brandt leitet es\./));
      await user.click(await screen.findByRole('button', { name: 'Als Quelle festlegen' }));

      expect(await screen.findByText('Als Quelle hinzugefügt')).toBeTruthy();
      expect(uploads[0]?.name).toMatch(/^Notiz vom .+\.txt$/);
      expect(await uploads[0]?.text()).toBe('Dr. Brandt leitet es.');
      vi.unstubAllGlobals();
    });

    it('deletes a note from the list after the confirmation', async () => {
      let deleted = false;
      serve();
      server.use(
        http.get(`${base}/notes`, () => HttpResponse.json(deleted ? [] : [note()])),
        http.delete(`${base}/notes/${NOTE_ID}`, () => {
          deleted = true;
          return new HttpResponse(null, { status: 204 });
        })
      );
      renderPanel();
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: /Weitere Aktionen für/ }));
      await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

      expect(await screen.findByText('Hier wird die Ausgabe von Studio gespeichert.')).toBeTruthy();
    });

    it('mentions the answer in the chat only when the note came from one', async () => {
      serve({ notes: [writtenNote({ title: 'Eigene Gedanken' })] });
      renderPanel();
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: /Weitere Aktionen für/ }));
      await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));
      const written = await screen.findByRole('alertdialog');
      expect(within(written).getByText('Die Notiz wird gelöscht.')).toBeTruthy();
      expect(within(written).queryByText(/Antwort im Chat/)).toBeNull();
    });

    it('says the answer in the chat stays when a saved answer is deleted', async () => {
      serve({ notes: [note()] });
      renderPanel();
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: /Weitere Aktionen für/ }));
      await user.click(await screen.findByRole('menuitem', { name: 'Löschen' }));

      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(/Die Antwort im Chat bleibt erhalten/)).toBeTruthy();
    });

    it('says so when the notes cannot be loaded, and still lists the outputs', async () => {
      serve({ outputs: [flashcardsOutput()] });
      server.use(
        http.get(`${base}/notes`, () =>
          HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 })
        )
      );
      renderPanel();

      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(row(/^Karteikarten/)).toBeTruthy();
    });
  });
  describe('adding a note', () => {
    /** A notebook that keeps the empty note it is asked to make, after failing as often as told. */
    function serveAddingNote(options: { failures?: number; delayMs?: number } = {}) {
      let made = false;
      let failures = options.failures ?? 0;
      const bodies: unknown[] = [];
      serve();
      server.use(
        http.get(`${base}/notes`, () => HttpResponse.json(made ? [writtenNote()] : [])),
        http.post(`${base}/notes`, async ({ request }) => {
          bodies.push(await request.json());
          if (failures > 0) {
            failures -= 1;
            return HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 });
          }
          await delay(options.delayMs ?? 0);
          made = true;
          return HttpResponse.json(writtenNote(), { status: 201 });
        })
      );
      return bodies;
    }

    it('makes an empty note at once and opens it for writing', async () => {
      const bodies = serveAddingNote();
      renderPanel();
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Notiz hinzufügen' }));

      expect(await screen.findByRole('textbox', { name: 'Text der Notiz' })).toBeTruthy();
      expect(bodies).toEqual([{ kind: NOTE_KIND.WRITTEN }]);
      expect(screen.getByRole('navigation', { name: 'Pfad' }).textContent).toContain('Notiz');
      await user.click(screen.getByRole('button', { name: 'Notizansicht schließen' }));
      expect(await waitForRow(/^Neue Notiz/)).toBeTruthy();
    });

    it('shows the note being made and cannot be pressed twice meanwhile', async () => {
      const bodies = serveAddingNote({ delayMs: 200 });
      renderPanel();
      const user = userEvent.setup();

      const button = await screen.findByRole('button', { name: 'Notiz hinzufügen' });
      await user.click(button);

      expect(await screen.findByText('Notiz wird erstellt …')).toBeTruthy();
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(await screen.findByRole('textbox', { name: 'Text der Notiz' })).toBeTruthy();
      expect(bodies).toHaveLength(1);
    });

    it('explains a failure and tries again', async () => {
      serveAddingNote({ failures: 1 });
      renderPanel();
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Notiz hinzufügen' }));
      expect(await screen.findByRole('alert')).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

      expect(await screen.findByRole('textbox', { name: 'Text der Notiz' })).toBeTruthy();
    });

    it('is a button on the rail too, which opens the column with the new note in it', async () => {
      serveAddingNote();
      const onExpand = vi.fn();
      renderWithProviders(
        <StudioPanel
          notebookId={NOTEBOOK_ID}
          collapsed
          onToggle={() => {}}
          onExpand={onExpand}
          onOpenCitation={() => {}}
          onAsk={() => {}}
        />
      );

      await userEvent
        .setup()
        .click(await screen.findByRole('button', { name: 'Notiz hinzufügen' }));

      await waitFor(() => expect(onExpand).toHaveBeenCalled());
    });
  });
});
