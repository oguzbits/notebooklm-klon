import { API_ERROR, CHAT_EVENT, type ChatEvent } from '@nlm/shared';
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
  JSON.stringify({ statements });

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

  it('fails before any provider call when no source is selected', async () => {
    const { ports, calls } = fakePorts({ selectedSourceIds: async () => [] });

    await expect(prepareAnswer(INPUT, ports)).rejects.toBeInstanceOf(NoSourcesSelectedError);

    expect(calls.embedded).toEqual([]);
  });
});

describe('answerQuestion', () => {
  it('streams a statement with real chunk IDs and then closes with the counts', async () => {
    const { ports } = fakePorts();

    const events = await run(ports);

    expect(events).toEqual([
      { type: CHAT_EVENT.STATEMENT, text: 'Dr. Brandt leitet es.', chunkIds: ['chunk-1'] },
      { type: CHAT_EVENT.DONE, statements: 1, droppedStatements: 0, strippedCitations: 0 },
    ]);
  });

  it('shows the model the numbered passages and the question', async () => {
    const { ports, calls } = fakePorts();

    await run(ports);

    expect(calls.modelInput?.user).toBe(
      '[c1]\nDr. Brandt leitet das Projekt.\n\n[c2]\nDas Budget beträgt 1,25 Mio.\n\nQuestion: Wer leitet das Projekt?'
    );
    expect(calls.modelInput?.system).toMatch(/context passages/i);
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
      { type: CHAT_EVENT.DONE, statements: 1, droppedStatements: 2, strippedCitations: 2 },
    ]);
  });

  it('sends each statement as soon as it is complete, before the model has finished', async () => {
    const order: string[] = [];
    const { ports } = fakePorts({
      stream: async function* () {
        yield '{"statements":[{"text":"Eins.","chunkIds":["c1"]},';
        order.push('after first statement');
        yield '{"text":"Zwei.","chunkIds":["c2"]}]}';
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
      { type: CHAT_EVENT.DONE, statements: 0, droppedStatements: 0, strippedCitations: 0 },
    ]);
    expect(modelCalled).toBe(false);
  });
});
