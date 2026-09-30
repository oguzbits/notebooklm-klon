import { type ChatEvent, ChatEventSchema } from '@nlm/shared';

import { toRequestError } from './api';

const DATA_PREFIX = 'data:';

/** The JSON of one server-sent event, or null for a block without data (a comment or a ping). */
function dataOf(block: string): string | null {
  const lines = block
    .split('\n')
    .filter((line) => line.startsWith(DATA_PREFIX))
    .map((line) => line.slice(DATA_PREFIX.length).trimStart());
  return lines.length > 0 ? lines.join('\n') : null;
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
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
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
