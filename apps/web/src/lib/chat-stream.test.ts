import { API_ERROR, CHAT_EVENT, type ChatEvent } from '@nlm/shared';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../vitest.setup';
import { ApiRequestError } from './api';
import { streamChat } from './chat-stream';

const NOTEBOOK = '3f0f4a4e-6c1e-4a52-9a53-0d6d1c6f2a10';
const STATEMENT: ChatEvent = { type: CHAT_EVENT.STATEMENT, text: 'Aussage.', chunkIds: ['a'] };
const DONE: ChatEvent = {
  type: CHAT_EVENT.DONE,
  statements: 1,
  droppedStatements: 0,
  strippedCitations: 0,
};

const frame = (event: ChatEvent) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;

/** A stream that hands out the text in pieces of the given size, like a slow network would. */
function slowStream(text: string, size: number) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < text.length; i += size) {
        controller.enqueue(encoder.encode(text.slice(i, i + size)));
      }
      controller.close();
    },
  });
}

async function collect(question = 'Frage?') {
  const events: ChatEvent[] = [];
  for await (const event of streamChat(NOTEBOOK, question)) events.push(event);
  return events;
}

describe('streamChat', () => {
  it('sends the question and yields the events in order', async () => {
    let body: unknown;
    server.use(
      http.post(`*/api/notebooks/${NOTEBOOK}/chat`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(frame(STATEMENT) + frame(DONE), {
          headers: { 'content-type': 'text/event-stream' },
        });
      })
    );

    expect(await collect('Wer leitet es?')).toEqual([STATEMENT, DONE]);
    expect(body).toEqual({ question: 'Wer leitet es?' });
  });

  it('puts an event back together that arrived in small pieces', async () => {
    server.use(
      http.post(
        `*/api/notebooks/${NOTEBOOK}/chat`,
        () => new HttpResponse(slowStream(frame(STATEMENT) + frame(DONE), 7))
      )
    );

    expect(await collect()).toEqual([STATEMENT, DONE]);
  });

  it('throws the API error when the answer cannot start', async () => {
    server.use(
      http.post(`*/api/notebooks/${NOTEBOOK}/chat`, () =>
        HttpResponse.json({ code: API_ERROR.NO_SOURCES_SELECTED }, { status: 409 })
      )
    );

    await expect(collect()).rejects.toMatchObject({
      code: API_ERROR.NO_SOURCES_SELECTED,
      status: 409,
    });
    await expect(collect()).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('rejects an event that does not match the shared contract', async () => {
    server.use(
      http.post(
        `*/api/notebooks/${NOTEBOOK}/chat`,
        () => new HttpResponse('event: X\ndata: {"type":"UNBEKANNT"}\n\n')
      )
    );

    await expect(collect()).rejects.toThrow();
  });
});
