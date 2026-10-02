import { API_ERROR, CHAT_EVENT, type ChatEvent, ChatEventSchema } from '@nlm/shared';

import { ApiRequestError, toRequestError } from './api';

const DATA_PREFIX = 'data:';

/** The JSON of one server-sent event, or null for a block without data (a comment or a ping). */
function dataOf(block: string): string | null {
  const lines = block
    .split('\n')
    .filter((line) => line.startsWith(DATA_PREFIX))
    .map((line) => line.slice(DATA_PREFIX.length).trimStart());
  return lines.length > 0 ? lines.join('\n') : null;
}

/** Puts the pieces of text together and yields the event of each block that is complete. */
async function* eventsOf(reader: ReadableStreamDefaultReader<string>): AsyncGenerator<ChatEvent> {
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += value.replaceAll('\r\n', '\n');
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const data = dataOf(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (data !== null) yield ChatEventSchema.parse(JSON.parse(data));
      end = buffer.indexOf('\n\n');
    }
  }
}

/**
 * Asks a question and yields the events of the streamed answer. Throws the API's error when the
 * answer cannot start (for example no source is ready). Events are checked against the shared
 * schema, so a change of the contract fails here and not somewhere in the UI.
 */
export async function* streamChat(
  notebookId: string,
  question: string,
  signal?: AbortSignal
): AsyncGenerator<ChatEvent> {
  const response = await fetch(`/api/notebooks/${notebookId}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!response.ok) throw await toRequestError(response);
  if (!response.body) throw new Error('The answer has no body.');

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  // Aborting the request does not always end a body that is being read, so the reader is cancelled too.
  const stop = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', stop, { once: true });
  let closed = false;
  try {
    for await (const event of eventsOf(reader)) {
      closed ||= event.type === CHAT_EVENT.DONE || event.type === CHAT_EVENT.ERROR;
      yield event;
    }
    signal?.throwIfAborted();
    // A stream that stops without its closing event was cut off: that is no finished answer.
    if (!closed) throw new ApiRequestError(API_ERROR.INTERNAL, response.status);
  } finally {
    signal?.removeEventListener('abort', stop);
    // Leaving early (the loop of the caller ends, an event is invalid) must not keep the connection open.
    stop();
  }
}
