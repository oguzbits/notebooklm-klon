import {
  API_ERROR,
  CHAT_EVENT,
  CHAT_STYLE,
  type ChatEvent,
  DEFAULT_CHAT_CONFIG,
} from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { GeminiError } from '../ai/gemini-error';
import { LIMITS } from '../config/limits';
import { answerQuestion, type ChatPorts, NoSourcesSelectedError, prepareAnswer } from './answer';

const INPUT = { userId: 'user-a', notebookId: 'notebook-1', question: 'Wer leitet das Projekt?' };
const CHUNKS = [
  {
    id: 'chunk-1',
    sourceId: 's1',
    ordinal: 0,
    text: 'Dr. Brandt leitet das Projekt.',
    startOffset: 0,
    endOffset: 30,
    score: 1,
  },
  {
    id: 'chunk-2',
    sourceId: 's1',
    ordinal: 1,
    text: 'Das Budget beträgt 1,25 Mio.',
    startOffset: 31,
    endOffset: 60,
    score: 0.5,
  },
];

const json = (...statements: { text: string; chunkIds: string[] }[]) =>
  JSON.stringify({ statements, followUps: [] });

/** A stream that fails on the first read. */
async function* failing(error: Error): AsyncGenerator<string> {
  yield await Promise.reject(error);
}

/** Splits text into small pieces, like a stream would. */
function* pieces(text: string, size = 7) {
  for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

function fakePorts(overrides: Partial<ChatPorts> = {}) {
  const calls = {
    search: [] as unknown[],
    embedded: [] as string[],
    modelInput: undefined as { system: string; user: string } | undefined,
    errors: [] as unknown[],
  };
  const ports: ChatPorts = {
    selectedSourceIds: async () => ['s1'],
    embedQuery: async (text) => {
      calls.embedded.push(text);
      return [0.1, 0.2];
    },
    search: async (params) => {
      calls.search.push(params);
      return CHUNKS;
    },
    stream: async function* (input) {
      calls.modelInput = input;
      yield* pieces(json({ text: 'Dr. Brandt leitet es.', chunkIds: ['c1'] }));
    },
    onError: (error) => {
      calls.errors.push(error);
    },
    ...overrides,
  };
  return { ports, calls };
}

async function run(ports: ChatPorts): Promise<ChatEvent[]> {
  const prepared = await prepareAnswer(INPUT, ports);
  const events: ChatEvent[] = [];
  for await (const event of answerQuestion(prepared, ports)) events.push(event);
  return events;
}

describe('prepareAnswer', () => {
  it('searches only the selected sources of the user with the question as text and vector', async () => {
    const { ports, calls } = fakePorts({ selectedSourceIds: async () => ['s1', 's2'] });

    await prepareAnswer(INPUT, ports);

    expect(calls.embedded).toEqual(['Wer leitet das Projekt?']);
    expect(calls.search).toEqual([
      {
        userId: 'user-a',
        notebookId: 'notebook-1',
        sourceIds: ['s1', 's2'],
        queryEmbedding: [0.1, 0.2],
        queryText: 'Wer leitet das Projekt?',
        limit: LIMITS.CHAT_CONTEXT_CHUNKS,
      },
    ]);
  });

  it('sends the model the system prompt of the notebook config', async () => {
    const { ports, calls } = fakePorts();
    const config = {
      ...DEFAULT_CHAT_CONFIG,
      style: CHAT_STYLE.CUSTOM,
      customInstruction: 'Antworte kurz und sachlich.',
    };

    const prepared = await prepareAnswer({ ...INPUT, config }, ports);
    for await (const _event of answerQuestion(prepared, ports)) {
      // Only the request to the model matters here.
    }

    expect(calls.modelInput?.system).toContain('Antworte kurz und sachlich.');
  });

  it('searches a follow-up question with the query the model rewrote from the history', async () => {
    const inputs: { system: string; user: string }[] = [];
    const { ports, calls } = fakePorts({
      stream: async function* (input) {
        inputs.push(input);
        yield '{"query":"Wer leitet das Projekt Nordlicht 2019?"}';
      },
    });
    const history = [{ question: 'Wer leitet Nordlicht?', answer: 'Dr. Brandt.' }];

    const prepared = await prepareAnswer({ ...INPUT, question: 'Und 2019?', history }, ports);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.user).toContain('Wer leitet Nordlicht?');
    expect(inputs[0]?.user).toContain('Last question: Und 2019?');
    expect(calls.embedded).toEqual(['Wer leitet das Projekt Nordlicht 2019?']);
    expect(calls.search).toMatchObject([{ queryText: 'Wer leitet das Projekt Nordlicht 2019?' }]);
    // The model still answers the question as the user wrote it.
    expect(prepared.question).toBe('Und 2019?');
  });

  it('asks the model nothing before the search when there is no history', async () => {
    let modelCalls = 0;
    const { ports } = fakePorts({
      stream: async function* () {
        modelCalls += 1;
        yield '';
      },
    });

    await prepareAnswer(INPUT, ports);

    expect(modelCalls).toBe(0);
  });

  it('fails instead of searching the bare follow-up when the rewrite is no valid query', async () => {
    const { ports, calls } = fakePorts({
      stream: async function* () {
        yield 'kein json';
      },
    });
    const history = [{ question: 'Frage?', answer: 'Antwort.' }];

    await expect(prepareAnswer({ ...INPUT, history }, ports)).rejects.toThrow();

    expect(calls.search).toEqual([]);
  });

  it('fails before any provider call when no source is selected', async () => {
    const { ports, calls } = fakePorts({ selectedSourceIds: async () => [] });

    await expect(prepareAnswer(INPUT, ports)).rejects.toBeInstanceOf(NoSourcesSelectedError);

    expect(calls.embedded).toEqual([]);
  });
});

describe('answerQuestion', () => {
  it('hands the signal of the request to the model and stays silent when the reader left', async () => {
    const reader = new AbortController();
    let received: AbortSignal | undefined;
    const { ports, calls } = fakePorts({
      stream: async function* (input) {
        received = input.signal;
        reader.abort();
        throw new DOMException('This operation was aborted', 'AbortError');
        yield '';
      },
    });
    const prepared = await prepareAnswer(INPUT, ports);

    const events: ChatEvent[] = [];
    for await (const event of answerQuestion(prepared, ports, reader.signal)) events.push(event);

    expect(received).toBe(reader.signal);
    expect(events).toEqual([]);
    expect(calls.errors).toEqual([]);
  });

  it('streams a statement with real chunk IDs and then closes with the counts', async () => {
    const { ports } = fakePorts();

    const events = await run(ports);

    expect(events).toEqual([
      { type: CHAT_EVENT.STATEMENT, text: 'Dr. Brandt leitet es.', chunkIds: ['chunk-1'] },
      {
        type: CHAT_EVENT.DONE,
        statements: 1,
        sourcesSearched: 1,
        passagesFound: 2,
        droppedStatements: 0,
        strippedCitations: 0,
        followUps: [],
      },
    ]);
  });

  it('closes with the questions the reader could ask next, tidied', async () => {
    const { ports } = fakePorts({
      stream: async function* () {
        yield* pieces(
          JSON.stringify({
            statements: [{ text: 'Dr. Brandt leitet es.', chunkIds: ['c1'] }],
            followUps: [
              'Wer leitet das Projekt?',
              'Wie hoch ist das Budget?',
              'wie hoch ist das Budget?',
            ],
          })
        );
      },
    });

    const events = await run(ports);

    expect(events.at(-1)).toMatchObject({
      type: CHAT_EVENT.DONE,
      followUps: ['Wie hoch ist das Budget?'],
    });
  });

  it('suggests nothing when no statement kept a valid citation', async () => {
    const { ports } = fakePorts({
      stream: async function* () {
        yield* pieces(
          JSON.stringify({
            statements: [{ text: 'Erfunden.', chunkIds: ['c9'] }],
            followUps: ['Wie geht es weiter?'],
          })
        );
      },
    });

    expect((await run(ports)).at(-1)).toMatchObject({ type: CHAT_EVENT.DONE, followUps: [] });
  });

  it('shows the model the history with the question, marked as no source', async () => {
    const { ports, calls } = fakePorts();
    const prepared = await prepareAnswer(INPUT, ports);

    for await (const _event of answerQuestion(
      { ...prepared, history: [{ question: 'Davor?', answer: 'Davon.' }] },
      ports
    )) {
      // Only the request to the model matters here.
    }

    expect(calls.modelInput?.user).toContain(
      '<history>\nQuestion: Davor?\nAnswer: Davon.\n</history>'
    );
    expect(calls.modelInput?.system).toMatch(/no source/);
  });

  it('shows the model the numbered passages and the question', async () => {
    const { ports, calls } = fakePorts();

    await run(ports);

    expect(calls.modelInput?.user).toBe(
      '<passages>\n[c1]\nDr. Brandt leitet das Projekt.\n\n[c2]\nDas Budget beträgt 1,25 Mio.\n</passages>\n\nQuestion: Wer leitet das Projekt?'
    );
  });

  it('leaves out a statement without a valid citation and counts what it removed', async () => {
    const { ports } = fakePorts({
      stream: async function* () {
        yield* pieces(
          json(
            { text: 'Belegt.', chunkIds: ['c2', 'c9'] },
            { text: 'Erfunden.', chunkIds: ['c7'] },
            { text: 'Ohne Zitat.', chunkIds: [] }
          )
        );
      },
    });

    const events = await run(ports);

    expect(events).toEqual([
      { type: CHAT_EVENT.STATEMENT, text: 'Belegt.', chunkIds: ['chunk-2'] },
      {
        type: CHAT_EVENT.DONE,
        statements: 1,
        sourcesSearched: 1,
        passagesFound: 2,
        droppedStatements: 2,
        strippedCitations: 2,
        followUps: [],
      },
    ]);
  });

  it('leaves out a statement whose number no cited passage says, and counts it as unbacked', async () => {
    const { ports } = fakePorts({
      stream: async function* () {
        yield* pieces(
          json(
            { text: 'Das Budget beträgt 1,25 Mio.', chunkIds: ['c2'] },
            { text: 'Das Budget wuchs um 12 Prozent.', chunkIds: ['c2'] }
          )
        );
      },
    });

    const events = await run(ports);

    expect(events.map((event) => event.type)).toEqual([CHAT_EVENT.STATEMENT, CHAT_EVENT.DONE]);
    expect(events[1]).toMatchObject({ statements: 1, droppedStatements: 1 });
  });

  it('accepts a number that only the question names', async () => {
    const { ports } = fakePorts({
      stream: async function* () {
        yield* pieces(json({ text: 'Dr. Brandt leitet das Projekt seit 2019.', chunkIds: ['c1'] }));
      },
    });
    const prepared = await prepareAnswer({ ...INPUT, question: 'Wer leitet es seit 2019?' }, ports);

    const events: ChatEvent[] = [];
    for await (const event of answerQuestion(prepared, ports)) events.push(event);

    expect(events[0]).toMatchObject({ type: CHAT_EVENT.STATEMENT });
  });

  it('sends a fact once when the model restates it, without counting it as unbacked', async () => {
    const { ports } = fakePorts({
      stream: async function* () {
        yield* pieces(
          json(
            { text: 'Dr. Brandt leitet das Projekt Nordlicht.', chunkIds: ['c1'] },
            { text: 'Das Projekt Nordlicht wird von Dr. Brandt geleitet.', chunkIds: ['c1'] }
          )
        );
      },
    });

    const events = await run(ports);

    expect(events.map((event) => event.type)).toEqual([CHAT_EVENT.STATEMENT, CHAT_EVENT.DONE]);
    expect(events[1]).toMatchObject({ statements: 1, droppedStatements: 0 });
  });

  it('sends each statement as soon as it is complete, before the model has finished', async () => {
    const order: string[] = [];
    const { ports } = fakePorts({
      stream: async function* () {
        yield '{"statements":[{"text":"Eins.","chunkIds":["c1"]},';
        order.push('after first statement');
        yield '{"text":"Zwei.","chunkIds":["c2"]}],"followUps":[]}';
        order.push('after second statement');
      },
    });

    const prepared = await prepareAnswer(INPUT, ports);
    for await (const event of answerQuestion(prepared, ports)) {
      if (event.type === CHAT_EVENT.STATEMENT) order.push(`event ${event.text}`);
    }

    expect(order).toEqual([
      'event Eins.',
      'after first statement',
      'event Zwei.',
      'after second statement',
    ]);
  });

  it('ends with an error event, keeping earlier statements, when the model fails midway', async () => {
    const { ports, calls } = fakePorts({
      stream: async function* () {
        yield '{"statements":[{"text":"Eins.","chunkIds":["c1"]},';
        throw new Error('Verbindung weg');
      },
    });

    const events = await run(ports);

    expect(events).toEqual([
      { type: CHAT_EVENT.STATEMENT, text: 'Eins.', chunkIds: ['chunk-1'] },
      { type: CHAT_EVENT.ERROR, code: API_ERROR.INTERNAL },
    ]);
    expect(calls.errors).toHaveLength(1);
  });

  it('reports a used-up provider quota with its own code', async () => {
    const { ports } = fakePorts({
      stream: () => failing(new GeminiError(429, 'quota')),
    });

    expect(await run(ports)).toEqual([
      { type: CHAT_EVENT.ERROR, code: API_ERROR.CHAT_LIMIT_REACHED },
    ]);
  });

  it('ends with an error event when the model text is cut off', async () => {
    const { ports } = fakePorts({
      stream: async function* () {
        yield '{"statements":[{"text":"Eins.","chunkIds":["c1"]}';
      },
    });

    const events = await run(ports);

    expect(events.at(-1)).toEqual({ type: CHAT_EVENT.ERROR, code: API_ERROR.INTERNAL });
    expect(events.some((event) => event.type === CHAT_EVENT.DONE)).toBe(false);
  });

  it('closes with no statements when nothing was found, without calling the model', async () => {
    let modelCalled = false;
    const { ports } = fakePorts({
      search: async () => [],
      stream: async function* () {
        modelCalled = true;
        yield '';
      },
    });

    expect(await run(ports)).toEqual([
      {
        type: CHAT_EVENT.DONE,
        statements: 0,
        sourcesSearched: 1,
        passagesFound: 0,
        droppedStatements: 0,
        strippedCitations: 0,
        followUps: [],
      },
    ]);
    expect(modelCalled).toBe(false);
  });
});
