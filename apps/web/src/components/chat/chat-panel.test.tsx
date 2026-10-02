import {
  API_ERROR,
  CHAT_EVENT,
  type ChatEvent,
  ChatRequestSchema,
  NOTE_KIND,
  SOURCE_STATUS,
} from '@nlm/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IncomingQuestion } from '@/hooks/use-incoming-question';
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
    <ChatPanel notebookId={NOTEBOOK_ID} onOpenCitation={onOpenCitation} onCustomize={() => {}} />
  );
}

const hangingStatement: ChatEvent = {
  type: CHAT_EVENT.STATEMENT,
  text: 'Dr. Brandt leitet es.',
  chunkIds: [CHUNK_ID],
};

/** An answer that sends one statement and then waits for ever, like a slow model. */
function hangingAnswer(onRequest: (question: string) => void = () => {}) {
  const encoder = new TextEncoder();
  return http.post(`${base}/chat`, async ({ request }) => {
    const { question } = ChatRequestSchema.parse(await request.json());
    onRequest(question);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(frame(hangingStatement)));
      },
    });
    return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
  });
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

  it('closes the passage when the chip is used, so it does not cover the opened source', async () => {
    server.use(
      sources(),
      history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]),
      http.get(`${base}/chunks/${CHUNK_ID}`, () => HttpResponse.json(chunkDetail()))
    );
    renderChat();
    const user = userEvent.setup();
    const chip = await screen.findByRole('button', { name: 'Quelle 1 anzeigen' });
    // The passage also opens when the chip has the focus, and then it stays until the focus leaves.
    chip.focus();
    await screen.findByText('Dr. Brandt leitet das Projekt Nordlicht.');

    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.queryByText('Dr. Brandt leitet das Projekt Nordlicht.')).toBeNull()
    );
  });

  it('does not open the passage after the mouse and the focus have left the chip', async () => {
    server.use(
      sources(),
      history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]),
      http.get(`${base}/chunks/${CHUNK_ID}`, () => HttpResponse.json(chunkDetail()))
    );
    renderChat();
    const user = userEvent.setup();
    const chip = await screen.findByRole('button', { name: 'Quelle 1 anzeigen' });

    // Hover and click within the opening delay: the hover and the focus each start a timer, and the
    // library forgets the first one when the chip loses the focus.
    await user.hover(chip);
    await user.click(chip);
    await user.unhover(chip);
    await user.click(document.body);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(screen.queryByText('Dr. Brandt leitet das Projekt Nordlicht.')).toBeNull();
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
      sourcesSearched: 1,
      passagesFound: 2,
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
    // A screen reader announces each statement as it arrives, not only that an answer is being written.
    const region = screen.getByText(/Dr\. Brandt leitet es\./).closest('[aria-live]');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.textContent).toContain('Antwort wird geschrieben …');
    // The question that is being answered opens the day as well, in an empty conversation.
    expect(screen.getByText(formatWeekday(new Date().toISOString()))).toBeTruthy();
    // One button per intent: while the answer is written it stops it, it does not send a second question.
    expect(screen.queryByRole('button', { name: 'Frage senden' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Antwort stoppen' })).toBeTruthy();
    expect(screen.getByLabelText('Deine Frage')).toHaveProperty('readOnly', true);

    release();

    await waitFor(() => expect(screen.queryByText('Antwort wird geschrieben …')).toBeNull());
    expect(screen.getByText('Wer leitet es?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Quelle 1 anzeigen' })).toBeTruthy();
  });

  describe('while an answer is written', () => {
    afterEach(() => vi.restoreAllMocks());

    /** The signals of the requests to the chat, as the browser got them. */
    function watchChatRequests() {
      const signals: AbortSignal[] = [];
      const real = globalThis.fetch;
      vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        if (String(input).endsWith('/chat') && init?.signal) signals.push(init.signal);
        return real(input, init);
      });
      return signals;
    }

    async function askAndWaitForText() {
      renderChat();
      const user = userEvent.setup();
      await screen.findByLabelText('Deine Frage');
      await user.type(screen.getByLabelText('Deine Frage'), 'Wer leitet es?');
      await user.click(screen.getByRole('button', { name: 'Frage senden' }));
      await screen.findByText(/Dr\. Brandt leitet es\./);
      return user;
    }

    it('ends the request, shows no error and loads what the server kept when the stop button is used', async () => {
      const signals = watchChatRequests();
      let loads = 0;
      server.use(
        sources(),
        http.get(`${base}/messages`, () => {
          loads += 1;
          // The server saves the cut answer a moment after the connection closed.
          return HttpResponse.json(
            loads < 3
              ? []
              : [
                  question('Wer leitet es?'),
                  answer([{ text: 'Dr. Brandt leitet es.', chunkIds: [CHUNK_ID] }]),
                ]
          );
        }),
        hangingAnswer()
      );
      const user = await askAndWaitForText();

      await user.click(screen.getByRole('button', { name: 'Antwort stoppen' }));

      await waitFor(() => expect(screen.queryByText('Antwort wird geschrieben …')).toBeNull());
      expect(signals.at(-1)?.aborted).toBe(true);
      expect(screen.queryByRole('button', { name: /Erneut versuchen/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Frage senden' })).toBeTruthy();
      expect(screen.getByLabelText('Deine Frage')).toHaveProperty('disabled', false);
      expect(
        await screen.findByRole('button', { name: 'Quelle 1 anzeigen' }, { timeout: 3000 })
      ).toBeTruthy();
    });

    it('keeps the field in the tab order and does not send from it while the answer is written', async () => {
      const signals = watchChatRequests();
      server.use(sources(), history([]), hangingAnswer());
      await askAndWaitForText();
      const field = screen.getByLabelText('Deine Frage');

      fireEvent.keyDown(field, { key: 'Enter' });

      // Read-only keeps the focus and the reading of the field, disabled would drop both.
      expect(field).toHaveProperty('readOnly', true);
      expect(field).toHaveProperty('disabled', false);
      expect(signals).toHaveLength(1);
    });

    it('puts the cursor back in the field when the answer ends', async () => {
      server.use(sources(), history([]), hangingAnswer());
      const user = await askAndWaitForText();

      await user.click(screen.getByRole('button', { name: 'Antwort stoppen' }));

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByLabelText('Deine Frage'))
      );
    });

    it('leaves the focus where the user put it meanwhile', async () => {
      server.use(sources(), history([]), hangingAnswer());
      await askAndWaitForText();
      const elsewhere = document.body.appendChild(document.createElement('input'));
      elsewhere.focus();

      fireEvent.click(screen.getByRole('button', { name: 'Antwort stoppen' }));

      await waitFor(() => expect(screen.queryByText('Antwort wird geschrieben …')).toBeNull());
      expect(document.activeElement).toBe(elsewhere);
      elsewhere.remove();
    });

    it('ends the request when the chat leaves the page', async () => {
      const signals = watchChatRequests();
      server.use(sources(), history([]), hangingAnswer());
      const { unmount } = await (async () => {
        const rendered = renderChat();
        const user = userEvent.setup();
        await screen.findByLabelText('Deine Frage');
        await user.type(screen.getByLabelText('Deine Frage'), 'Wer leitet es?');
        await user.click(screen.getByRole('button', { name: 'Frage senden' }));
        await screen.findByText(/Dr\. Brandt leitet es\./);
        return rendered;
      })();

      unmount();

      expect(signals.at(-1)?.aborted).toBe(true);
    });

    it('shows an answer that was cut off without its end as a failure with a retry', async () => {
      server.use(
        sources(),
        history([]),
        http.post(
          `${base}/chat`,
          () =>
            new HttpResponse(frame(hangingStatement), {
              headers: { 'content-type': 'text/event-stream' },
            })
        )
      );
      renderChat();
      const user = userEvent.setup();
      await screen.findByLabelText('Deine Frage');
      await user.type(screen.getByLabelText('Deine Frage'), 'Wer leitet es?');
      await user.click(screen.getByRole('button', { name: 'Frage senden' }));

      expect(await screen.findByRole('button', { name: /Erneut versuchen/ })).toBeTruthy();
    });
  });

  it('does not send while a composition is open, because Enter then confirms the characters', async () => {
    const signals: Request[] = [];
    server.use(
      sources(),
      history([]),
      http.post(`${base}/chat`, ({ request }) => {
        signals.push(request);
        return new HttpResponse('', { headers: { 'content-type': 'text/event-stream' } });
      })
    );
    renderChat();
    const user = userEvent.setup();
    const field = await screen.findByLabelText('Deine Frage');
    await user.type(field, 'にほん');

    // Chrome marks it with isComposing, Safari ends the composition first and reports keyCode 229.
    // A send empties the field at once, the request itself follows later, so the text shows it.
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    expect(field).toHaveProperty('value', 'にほん');
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    expect(field).toHaveProperty('value', 'にほん');
    expect(signals).toHaveLength(0);

    await user.keyboard('{Enter}');
    await waitFor(() => expect(signals).toHaveLength(1));
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

  describe('a question from elsewhere on the page', () => {
    const EXPLAIN = 'Erkläre das genauer.';

    /** The chat with a button that sends it a question, like "Erklären" on a card of the Studio. */
    function ChatWithExplain() {
      const [incoming, setIncoming] = useState<IncomingQuestion | null>(null);
      return (
        <>
          <button
            type="button"
            onClick={() => setIncoming((c) => ({ id: (c?.id ?? 0) + 1, question: EXPLAIN }))}
          >
            Erklären
          </button>
          <ChatPanel
            notebookId={NOTEBOOK_ID}
            onOpenCitation={() => {}}
            onCustomize={() => {}}
            incoming={incoming}
          />
        </>
      );
    }

    /** Answers every question of the chat with a stream that waits for ever, and lists the questions. */
    function recordQuestions() {
      const asked: string[] = [];
      server.use(hangingAnswer((question) => asked.push(question)));
      return asked;
    }

    it('waits for the answer that is being written and asks after it, instead of losing the question', async () => {
      server.use(sources(), history([]));
      const asked = recordQuestions();
      renderWithProviders(<ChatWithExplain />);
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText('Deine Frage'), 'Wer leitet es?');
      await user.click(screen.getByRole('button', { name: 'Frage senden' }));
      await screen.findByRole('button', { name: 'Antwort stoppen' });

      await user.click(screen.getByRole('button', { name: 'Erklären' }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(asked).toEqual(['Wer leitet es?']);

      await user.click(screen.getByRole('button', { name: 'Antwort stoppen' }));
      await waitFor(() => expect(asked).toEqual(['Wer leitet es?', EXPLAIN]));

      await user.click(await screen.findByRole('button', { name: 'Antwort stoppen' }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(asked).toEqual(['Wer leitet es?', EXPLAIN]);
    });

    it('says that it was not asked when no source can answer it', async () => {
      server.use(sources([source({ status: SOURCE_STATUS.PROCESSING })]), history([]));
      const asked = recordQuestions();
      renderWithProviders(<ChatWithExplain />);
      await screen.findByText(/mindestens eine fertig gelesene Quelle/);

      await userEvent.setup().click(screen.getByRole('button', { name: 'Erklären' }));

      expect(await screen.findByText(/Die Frage wurde nicht gestellt/)).toBeTruthy();
      expect(asked).toEqual([]);
    });

    it('does not ask a dropped question later, when a source becomes ready', async () => {
      let list = [source({ status: SOURCE_STATUS.PROCESSING })];
      server.use(
        http.get(`${base}/sources`, () => HttpResponse.json(list)),
        history([])
      );
      const asked = recordQuestions();
      renderWithProviders(<ChatWithExplain />);
      await screen.findByText(/mindestens eine fertig gelesene Quelle/);
      await userEvent.setup().click(screen.getByRole('button', { name: 'Erklären' }));
      await screen.findByText(/Die Frage wurde nicht gestellt/);

      // The list of sources is read again every two seconds while one is being processed.
      list = [source()];
      await waitFor(
        () => expect(screen.queryByText(/mindestens eine fertig gelesene Quelle/)).toBeNull(),
        { timeout: 4000 }
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(asked).toEqual([]);
    }, 8000);
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

  it('puts "In Notiz speichern" before "Kopieren" under an answer, like the original', async () => {
    server.use(sources(), history([answer([{ text: 'Aussage.', chunkIds: [CHUNK_ID] }])]));
    renderChat();

    const saves = await screen.findAllByRole('button', { name: 'In Notiz speichern' });
    const copies = screen.getAllByRole('button', { name: 'Kopieren' });
    const save = saves[saves.length - 1]!;
    const copy = copies[copies.length - 1]!;

    expect(save.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers the steps of an answer that kept them, and nothing for an older one', async () => {
    server.use(
      sources(),
      history([
        answer([{ text: 'Neu.', chunkIds: [CHUNK_ID] }], [], {
          sourcesSearched: 1,
          passagesFound: 3,
          droppedStatements: 0,
          strippedCitations: 0,
        }),
        {
          ...answer([{ text: 'Alt.', chunkIds: [CHUNK_ID] }]),
          id: '55555555-5555-4555-8555-555555555555',
        },
      ])
    );
    renderChat();

    await screen.findByText('Neu.');
    expect(screen.getAllByRole('button', { name: 'Vorgehen' })).toHaveLength(1);
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
