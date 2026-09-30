import { API_ERROR, CHAT_EVENT, type ChatEvent, SOURCE_STATUS } from '@nlm/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import {
  answer,
  CHUNK_ID,
  chunkDetail,
  NOTEBOOK_ID,
  OTHER_CHUNK_ID,
  question,
  source,
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

describe('ChatPanel', () => {
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
});
