import { API_ERROR, CHAT_EVENT, type ChatEvent, SOURCE_STATUS } from '@nlm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  answer,
  ANSWER_ID,
  CHUNK_ID,
  chunkDetail,
  note,
  NOTEBOOK_ID,
  OTHER_CHUNK_ID,
  overview,
  question,
  source,
  SOURCE_ID,
} from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';

import { server } from '../../../../../vitest.setup';
import { ChatPanel } from './chat-panel';

const base = `*/api/notebooks/${NOTEBOOK_ID}`;
const sources = (list = [source()]) => http.get(`${base}/sources`, () => HttpResponse.json(list));
const history = (messages: unknown[]) =>
  http.get(`${base}/messages`, () => HttpResponse.json(messages));

const frame = (event: ChatEvent) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

function renderChat(onOpenCitation: (chunkId: string) => void = () => {}) {
  return renderWithProviders(
    <ChatPanel notebookId={NOTEBOOK_ID} onOpenCitation={onOpenCitation} />
  );
}

const overviewOf = (sourceId: string, body: JsonBodyType, status = 200) =>
  http.get(`${base}/sources/${sourceId}/overview`, () => HttpResponse.json(body, { status }));

describe('ChatPanel', () => {
  // Answers ask for the notes, to show which are saved. Most tests do not care about them.
  beforeEach(() => {
    server.use(http.get(`${base}/notes`, () => HttpResponse.json([])));
  });

  it('invites the user to ask the first question when the history is empty', async () => {
    server.use(sources(), history([]));
    renderChat();

    expect(await screen.findByText('Stelle deine erste Frage')).toBeTruthy();
  });

  it('shows saved answers with numbered chips that repeat for the same passage', async () => {
    server.use(
      sources(),
      history([
        question('Wer leitet es?'),
        answer([
          { text: 'Dr. Brandt leitet es.', chunkIds: [CHUNK_ID] },
          { text: 'Es heißt Nordlicht.', chunkIds: [OTHER_CHUNK_ID, CHUNK_ID] },
        ]),
      ])
    );
    renderChat();

    expect(await screen.findByText('Wer leitet es?')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Quelle 1 anzeigen' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Quelle 2 anzeigen' })).toHaveLength(1);
  });

  it('opens the source when a chip is clicked', async () => {
    server.use(sources(), history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]));
    const onOpen = vi.fn();
    renderChat(onOpen);

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Quelle 1 anzeigen' }));

    expect(onOpen).toHaveBeenCalledWith(CHUNK_ID);
  });

  it('shows the passage and its source when the mouse rests on a chip', async () => {
    server.use(
      sources(),
      history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]),
      http.get(`${base}/chunks/${CHUNK_ID}`, () => HttpResponse.json(chunkDetail()))
    );
    renderChat();

    await userEvent.setup().hover(await screen.findByRole('button', { name: 'Quelle 1 anzeigen' }));

    expect(await screen.findByText('Dr. Brandt leitet das Projekt Nordlicht.')).toBeTruthy();
    expect(screen.getByText('projekt.pdf')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quelle anzeigen' })).toBeTruthy();
  });

  it('cannot ask while no ready source is selected, and says why', async () => {
    server.use(sources([source({ status: SOURCE_STATUS.PROCESSING })]), history([]));
    renderChat();

    expect(await screen.findByText(/mindestens eine fertig gelesene Quelle/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Frage senden' })).toHaveProperty('disabled', true);
  });

  it('streams the answer, blocks a second question meanwhile and loads the saved answer after', async () => {
    let saved = false;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const statement: ChatEvent = {
      type: CHAT_EVENT.STATEMENT,
      text: 'Dr. Brandt leitet es.',
      chunkIds: [CHUNK_ID],
    };
    const done: ChatEvent = {
      type: CHAT_EVENT.DONE,
      statements: 1,
      droppedStatements: 0,
      strippedCitations: 0,
    };
    const encoder = new TextEncoder();
    server.use(
      sources(),
      http.get(`${base}/messages`, () =>
        HttpResponse.json(
          saved
            ? [
                question('Wer leitet es?'),
                answer([{ text: 'Dr. Brandt leitet es.', chunkIds: [CHUNK_ID] }]),
              ]
            : []
        )
      ),
      http.post(`${base}/chat`, () => {
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(encoder.encode(frame(statement)));
            await gate;
            saved = true;
            controller.enqueue(encoder.encode(frame(done)));
            controller.close();
          },
        });
        return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
      })
    );
    renderChat();
    const user = userEvent.setup();
    await screen.findByText('Stelle deine erste Frage');

    await user.type(screen.getByLabelText('Deine Frage'), 'Wer leitet es?');
    await user.click(screen.getByRole('button', { name: 'Frage senden' }));

    expect(await screen.findByText(/Dr\. Brandt leitet es\./)).toBeTruthy();
    expect(screen.getByText('Antwort wird geschrieben …')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Frage senden' })).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Deine Frage')).toHaveProperty('disabled', true);

    release();

    await waitFor(() => expect(screen.queryByText('Antwort wird geschrieben …')).toBeNull());
    expect(screen.getByText('Wer leitet es?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quelle 1 anzeigen' })).toBeTruthy();
  });

  it('shows a German message and a retry when the answer cannot start', async () => {
    server.use(
      sources(),
      history([]),
      http.post(`${base}/chat`, () =>
        HttpResponse.json({ code: API_ERROR.CHAT_LIMIT_REACHED }, { status: 429 })
      )
    );
    renderChat();
    const user = userEvent.setup();
    await screen.findByText('Stelle deine erste Frage');

    await user.type(screen.getByLabelText('Deine Frage'), 'Wer?');
    await user.click(screen.getByRole('button', { name: 'Frage senden' }));

    expect(await screen.findByText(/keine Antworten mehr möglich/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Erneut versuchen/ })).toBeTruthy();
  });

  it('offers the suggested questions of the selected sources and asks one on click', async () => {
    let asked: unknown;
    server.use(
      sources(),
      history([]),
      overviewOf(SOURCE_ID, overview()),
      http.post(`${base}/chat`, async ({ request }) => {
        asked = await request.json();
        return new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } });
      })
    );
    renderChat();

    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Wer leitet das Projekt?' }));

    await waitFor(() => expect(asked).toEqual({ question: 'Wer leitet das Projekt?' }));
  });

  it('asks for the suggestions of ready, selected sources only', async () => {
    const skipped = '7c3a0e4b-9d56-4b8f-9e27-4c0a8d3b5e69';
    const requested: string[] = [];
    server.use(
      sources([source(), source({ id: skipped, selected: false })]),
      history([]),
      http.get(`${base}/sources/:sourceId/overview`, ({ params }) => {
        requested.push(String(params.sourceId));
        return HttpResponse.json(overview());
      })
    );
    renderChat();

    await screen.findByRole('button', { name: 'Wer leitet das Projekt?' });

    expect(requested).toEqual([SOURCE_ID]);
  });

  it('says so when the suggestions cannot be made, and still lets the user ask', async () => {
    server.use(sources(), history([]), overviewOf(SOURCE_ID, { code: API_ERROR.INTERNAL }, 500));
    renderChat();

    expect(await screen.findByText(/Vorschläge konnten nicht erstellt werden/)).toBeTruthy();
    expect(screen.getByLabelText('Deine Frage').hasAttribute('disabled')).toBe(false);
  });

  it('saves an answer as a note and then shows that it is saved', async () => {
    let body: unknown;
    let saved = false;
    server.use(
      sources(),
      history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]),
      http.get(`${base}/notes`, () => HttpResponse.json(saved ? [note()] : [])),
      http.post(`${base}/notes`, async ({ request }) => {
        body = await request.json();
        saved = true;
        return HttpResponse.json(note(), { status: 201 });
      })
    );
    renderChat();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Als Notiz speichern' }));

    expect(await screen.findByText('Als Notiz gespeichert')).toBeTruthy();
    expect(body).toEqual({ messageId: ANSWER_ID });
  });

  it('shows an answer that is already a note as saved', async () => {
    server.use(
      sources(),
      history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]),
      http.get(`${base}/notes`, () => HttpResponse.json([note()]))
    );
    renderChat();

    expect(await screen.findByText('Als Notiz gespeichert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Als Notiz speichern' })).toBeNull();
  });
});
