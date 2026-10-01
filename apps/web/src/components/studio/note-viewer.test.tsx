import { API_ERROR, NOTE_KIND, NoteUpdateBodySchema, SUBMIT_ACTION } from '@nlm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NEW_NOTE_TITLE } from '@/components/studio/studio-labels';
import { CHUNK_ID, note, NOTE_ID, NOTEBOOK_ID, writtenNote } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { NoteViewer } from './note-viewer';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;
const SAVED_WAIT = { timeout: 4000 };

type View = Parameters<typeof NoteViewer>[0]['note'];

function renderNote(
  shown: View,
  props: { onDelete?: () => void; onOpenCitation?: (id: string) => void } = {}
) {
  return renderWithProviders(
    <NoteViewer
      notebookId={NOTEBOOK_ID}
      note={shown}
      deleting={false}
      onDelete={props.onDelete ?? (() => {})}
      onOpenCitation={props.onOpenCitation ?? (() => {})}
    />
  );
}

/** Answers every change of a note by echoing it, and keeps what was sent. */
function serveUpdates(shown: View) {
  const sent: unknown[] = [];
  server.use(
    http.patch(`${base}/notes/${NOTE_ID}`, async ({ request }) => {
      const changes = NoteUpdateBodySchema.parse(await request.json());
      sent.push(changes);
      return HttpResponse.json({ ...shown, ...changes });
    })
  );
  return sent;
}

// The editor puts its text into the page a moment after the note opens.
const editor = () => screen.findByRole('textbox', { name: 'Text der Notiz' });

/** Opens a note of the reader and waits until its editor is there. */
async function openNote(...args: Parameters<typeof renderNote>) {
  const view = renderNote(...args);
  await editor();
  return view;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NoteViewer, a note of the reader', () => {
  it('shows a placeholder while the editor loads', () => {
    renderNote(writtenNote());

    expect(screen.getByRole('status', { name: 'Wird geladen' })).toBeTruthy();
  });

  it('opens with the tools of the original and its saved text as formatted text', async () => {
    await openNote(writtenNote({ body: 'Ein **fetter** Satz.' }));

    for (const name of [
      'Rückgängig machen',
      'Wiederholen',
      'Textformat',
      'Fett',
      'Kursiv',
      'Verknüpfen',
      'Als Code markieren',
      'Codeblock',
      'Weitere Editor-Tools anzeigen',
    ]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect((await editor()).querySelector('strong')?.textContent).toBe('fetter');
    expect(
      (screen.getByRole('textbox', { name: 'Titel der Notiz' }) as HTMLInputElement).value
    ).toBe(NEW_NOTE_TITLE);
  });

  it('saves what is typed after a pause, as Markdown, and says so', async () => {
    const shown = writtenNote();
    const sent = serveUpdates(shown);
    await openNote(shown);
    const user = userEvent.setup();

    await user.click(await editor());
    await user.keyboard('Hallo Welt');

    expect(await screen.findByText('Gespeichert', undefined, SAVED_WAIT)).toBeTruthy();
    expect(sent).toEqual([{ body: 'Hallo Welt' }]);
  });

  it('puts the cursor in a new, empty note', async () => {
    await openNote(writtenNote());

    await waitFor(async () => expect(document.activeElement).toBe(await editor()));
  });

  it('formats with the tools: bold turns the typed text into Markdown', async () => {
    const shown = writtenNote();
    const sent = serveUpdates(shown);
    await openNote(shown);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Fett' }));
    // Tiptap puts the cursor in the text a moment after a tool was pressed.
    await waitFor(async () => expect(document.activeElement).toBe(await editor()));
    await user.keyboard('wichtig');

    await waitFor(() => expect(sent).toEqual([{ body: '**wichtig**' }]), SAVED_WAIT);
  });

  it('saves a list without the empty line the editor keeps after it', async () => {
    const shown = writtenNote();
    const sent = serveUpdates(shown);
    await openNote(shown);
    const user = userEvent.setup();

    await user.click(await editor());
    await user.keyboard('- Eins{Enter}Zwei');

    await waitFor(() => expect(sent).toEqual([{ body: '- Eins\n- Zwei' }]), SAVED_WAIT);
  });

  it('says that saving failed, and sends the text again on request', async () => {
    const shown = writtenNote();
    let attempts = 0;
    const sent: unknown[] = [];
    server.use(
      http.patch(`${base}/notes/${NOTE_ID}`, async ({ request }) => {
        attempts += 1;
        if (attempts === 1) return HttpResponse.json({ code: API_ERROR.INTERNAL }, { status: 500 });
        const changes = NoteUpdateBodySchema.parse(await request.json());
        sent.push(changes);
        return HttpResponse.json({ ...shown, ...changes });
      })
    );
    await openNote(shown);
    const user = userEvent.setup();

    await user.click(await editor());
    await user.keyboard('Wichtig');
    const alert = await screen.findByRole('alert', undefined, SAVED_WAIT);
    expect(alert.textContent).toContain('konnte nicht gespeichert werden');

    await user.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(await screen.findByText('Gespeichert')).toBeTruthy();
    expect(sent).toEqual([{ body: 'Wichtig' }]);
  });

  it('saves what is left when the note is closed', async () => {
    const shown = writtenNote();
    const sent = serveUpdates(shown);
    const { unmount } = await openNote(shown);
    const user = userEvent.setup();

    await user.click(await editor());
    await user.keyboard('Noch nicht gespeichert');
    unmount();

    await waitFor(() => expect(sent).toEqual([{ body: 'Noch nicht gespeichert' }]));
  });

  it('is named by clicking its title', async () => {
    const shown = writtenNote({ body: 'Schon etwas Text' });
    const sent = serveUpdates(shown);
    await openNote(shown);
    const user = userEvent.setup();

    const title = screen.getByRole('textbox', { name: 'Titel der Notiz' });
    await user.clear(title);
    await user.type(title, 'Meine Idee{Enter}');

    await waitFor(() => expect(sent).toEqual([{ title: 'Meine Idee' }]));
  });

  it('puts the text among the sources as a Markdown file named like the note', async () => {
    const uploads: File[] = [];
    const realFetch = globalThis.fetch;
    // Only the upload is answered here (jsdom's FormData is no body for Node's fetch).
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (!String(input).endsWith('/sources/file')) return realFetch(input, init);
        uploads.push((init?.body as FormData).get('file') as File);
        return Response.json(
          { sourceId: CHUNK_ID, action: SUBMIT_ACTION.CREATED },
          { status: 202 }
        );
      })
    );
    await openNote(writtenNote({ title: 'Meine Idee', body: '# Idee\n\nEin **Absatz**.' }));
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Als Quelle festlegen' }));

    expect(await screen.findByText('Als Quelle hinzugefügt')).toBeTruthy();
    expect(uploads[0]?.name).toBe('Meine Idee.md');
    expect(await uploads[0]?.text()).toBe('# Idee\n\nEin **Absatz**.');
  });

  it('makes no source of an empty note', async () => {
    await openNote(writtenNote());

    expect(
      (screen.getByRole('button', { name: 'Als Quelle festlegen' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('asks to delete through the trash can', async () => {
    const onDelete = vi.fn();
    await openNote(writtenNote(), { onDelete });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Notiz löschen' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe('NoteViewer, a saved answer', () => {
  it('has no tools and no editor, because its chips vouch for its text', () => {
    renderNote(note());

    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Text der Notiz' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Quelle 1 anzeigen' })).toBeTruthy();
  });

  it('can be named, and the name is what the list shows', async () => {
    const shown = note();
    const sent = serveUpdates(shown);
    renderNote(shown);
    const user = userEvent.setup();

    const title = screen.getByRole('textbox', { name: 'Titel der Notiz' });
    expect((title as HTMLInputElement).value).toBe('Dr. Brandt leitet es.');
    await user.clear(title);
    await user.type(title, 'Wer leitet es?{Enter}');

    await waitFor(() => expect(sent).toEqual([{ title: 'Wer leitet es?' }]));
  });

  it('is a plain text file as a source, named by the title once it has one', async () => {
    const uploads: File[] = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        if (!String(input).endsWith('/sources/file')) return realFetch(input, init);
        uploads.push((init?.body as FormData).get('file') as File);
        return Response.json(
          { sourceId: CHUNK_ID, action: SUBMIT_ACTION.CREATED },
          { status: 202 }
        );
      })
    );
    renderNote(note({ kind: NOTE_KIND.ANSWER, title: 'Wer leitet es?' }));

    await userEvent.setup().click(screen.getByRole('button', { name: 'Als Quelle festlegen' }));

    expect(await screen.findByText('Als Quelle hinzugefügt')).toBeTruthy();
    expect(uploads[0]?.name).toBe('Wer leitet es?.txt');
  });
});
