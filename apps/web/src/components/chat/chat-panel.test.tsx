import { API_ERROR, CHAT_EVENT, type ChatEvent, NOTE_KIND, SOURCE_STATUS } from '@nlm/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatWeekday } from '@/lib/day';
import {
  answer,
  ANSWER_ID,
  CHUNK_ID,
  chunkDetail,
  note,
  notebook,
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
  // The notebook and its overview lead the chat once a source is ready. Most tests do not care.
  beforeEach(() => {
    server.use(
      http.get(`${base}/notes`, () => HttpResponse.json([])),
      http.get('*/api/notebooks', () => HttpResponse.json([notebook({ title: 'Steuerrecht' })])),
      http.get(`${base}/overview`, () =>
        HttpResponse.json({ overview: { emoji: '📚', summary: 'Es geht um **Steuern**.' } })
      )
    );
  });

  it('invites the user to ask the first question while no source is ready', async () => {
    server.use(sources([]), history([]));
    renderChat();

    expect(await screen.findByText('Stelle deine erste Frage')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Steuerrecht' })).toBeNull();
  });

  it('leads with the overview of the notebook once a source is ready, and invites to ask under it', async () => {
    server.use(sources(), history([]));
    renderChat();

    expect(await screen.findByRole('heading', { name: 'Steuerrecht' })).toBeTruthy();
    expect((await screen.findByText('Steuern')).tagName).toBe('STRONG');
    expect(screen.getByText(/Jede Aussage einer Antwort hat eine Nummer/)).toBeTruthy();
    expect(screen.queryByText('Stelle deine erste Frage')).toBeNull();
  });

  it('keeps the overview above the conversation, so it scrolls away with it', async () => {
    server.use(
      sources(),
      history([question('Wer leitet es?'), answer([{ text: 'Er.', chunkIds: [CHUNK_ID] }])])
    );
    renderChat();

    const title = await screen.findByRole('heading', { name: 'Steuerrecht' });
    const asked = await screen.findByText('Wer leitet es?');

    expect(title.compareDocumentPosition(asked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('starts each day of the conversation with its weekday and date, once', async () => {
    const asked = (id: string, text: string, at: Date) => ({
      ...question(text),
      id,
      createdAt: at.toISOString(),
    });
    server.use(
      sources(),
      history([
        asked('a1111111-1111-4111-8111-111111111111', 'Erste Frage', new Date(2026, 8, 30, 9)),
        asked('a2222222-2222-4222-8222-222222222222', 'Zweite Frage', new Date(2026, 8, 30, 18)),
        asked('a3333333-3333-4333-8333-333333333333', 'Dritte Frage', new Date(2026, 9, 1, 8)),
      ])
    );
    renderChat();

    await screen.findByText('Dritte Frage');
    expect(screen.getAllByText('Mittwoch, 30. September')).toHaveLength(1);
    expect(screen.getAllByText('Donnerstag, 1. Oktober')).toHaveLength(1);
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
      followUps: [],
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
    await screen.findByLabelText('Deine Frage');

    await user.type(screen.getByLabelText('Deine Frage'), 'Wer leitet es?');
    await user.click(screen.getByRole('button', { name: 'Frage senden' }));

    expect(await screen.findByText(/Dr\. Brandt leitet es\./)).toBeTruthy();
    expect(screen.getByText('Antwort wird geschrieben …')).toBeTruthy();
    // The question that is being answered opens the day as well, in an empty conversation.
    expect(screen.getByText(formatWeekday(new Date().toISOString()))).toBeTruthy();
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
    await screen.findByLabelText('Deine Frage');

    await user.type(screen.getByLabelText('Deine Frage'), 'Wer?');
    await user.click(screen.getByRole('button', { name: 'Frage senden' }));

    expect(await screen.findByText(/keine Antworten mehr möglich/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Erneut versuchen/ })).toBeTruthy();
  });

  describe('questions that could follow an answer', () => {
    const followUps = ['Wie hoch ist das Budget?', 'Wer arbeitet noch mit?'];
    const asking = () => {
      const asked: unknown[] = [];
      server.use(
        http.post(`${base}/chat`, async ({ request }) => {
          asked.push(await request.json());
          return new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } });
        })
      );
      return asked;
    };

    it('shows them under the last answer and asks one on click', async () => {
      const asked = asking();
      server.use(
        sources(),
        history([
          question('Wer leitet es?'),
          answer([{ text: 'Dr. Brandt leitet es.', chunkIds: [CHUNK_ID] }], followUps),
        ])
      );
      renderChat();

      const list = await screen.findByRole('list', { name: 'Vorschläge für weitere Fragen' });
      expect(within(list).getAllByRole('button')).toHaveLength(2);
      await userEvent.setup().click(within(list).getByRole('button', { name: followUps[0] }));

      await waitFor(() => expect(asked).toEqual([{ question: 'Wie hoch ist das Budget?' }]));
    });

    it('shows them only under the last answer of the conversation', async () => {
      server.use(
        sources(),
        history([
          question('Eins?'),
          answer([{ text: 'Eins.', chunkIds: [CHUNK_ID] }], ['Nur für die alte Antwort?']),
          question('Zwei?'),
          answer([{ text: 'Zwei.', chunkIds: [CHUNK_ID] }], followUps),
        ])
      );
      renderChat();

      await screen.findByRole('list', { name: 'Vorschläge für weitere Fragen' });
      expect(screen.queryByText('Nur für die alte Antwort?')).toBeNull();
    });

    it('shows nothing when the last message is a question or the answer has none', async () => {
      server.use(
        sources(),
        history([
          question('Wer leitet es?'),
          answer([{ text: 'Dr. Brandt.', chunkIds: [CHUNK_ID] }]),
        ])
      );
      renderChat();

      await screen.findByText('Wer leitet es?');
      expect(screen.queryByRole('list', { name: 'Vorschläge für weitere Fragen' })).toBeNull();
    });

    it('cannot be used while no ready source is selected', async () => {
      server.use(
        sources([source({ selected: false })]),
        history([answer([{ text: 'Dr. Brandt.', chunkIds: [CHUNK_ID] }], followUps)])
      );
      renderChat();

      const list = await screen.findByRole('list', { name: 'Vorschläge für weitere Fragen' });
      for (const card of within(list).getAllByRole('button')) {
        expect(card).toHaveProperty('disabled', true);
      }
    });
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

  describe('the jump to the end', () => {
    // jsdom has no layout: the scroll area gets the sizes of a long conversation by hand.
    function scrollArea(position: number) {
      const area = screen.getByTestId('chat-scroll');
      Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 1000 });
      Object.defineProperty(area, 'clientHeight', { configurable: true, value: 400 });
      area.scrollTop = position;
      area.scrollTo = vi.fn();
      fireEvent.scroll(area);
      return area;
    }

    it('shows a button when the chat is not at its end and scrolls down on click', async () => {
      server.use(sources(), history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]));
      renderChat();
      await screen.findByText('Aussage.');
      const user = userEvent.setup();

      const area = scrollArea(0);
      await user.click(await screen.findByRole('button', { name: 'Nach unten springen' }));

      expect(area.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' });
    });

    it('hides the button again at the end of the chat', async () => {
      server.use(sources(), history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]));
      renderChat();
      await screen.findByText('Aussage.');

      scrollArea(0);
      await screen.findByRole('button', { name: 'Nach unten springen' });
      scrollArea(590);

      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Nach unten springen' })).toBeNull()
      );
    });
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

    // The overview above has the same button; the one of the answer is the last on the page.
    const buttons = await screen.findAllByRole('button', { name: 'In Notiz speichern' });
    await user.click(buttons[buttons.length - 1]!);

    expect(await screen.findByText('In Notiz gespeichert')).toBeTruthy();
    expect(body).toEqual({ kind: NOTE_KIND.ANSWER, messageId: ANSWER_ID });
  });

  it('shows an answer that is already a note as saved', async () => {
    server.use(
      sources(),
      history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]),
      http.get(`${base}/notes`, () => HttpResponse.json([note()]))
    );
    renderChat();

    expect(await screen.findByText('In Notiz gespeichert')).toBeTruthy();
    // What is left is the button of the overview, the answer has none.
    await screen.findByText('Steuern');
    expect(screen.getAllByRole('button', { name: 'In Notiz speichern' })).toHaveLength(1);
  });
});
