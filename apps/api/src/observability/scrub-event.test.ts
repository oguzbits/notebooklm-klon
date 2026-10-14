import type { ErrorEvent } from '@sentry/node';
import { describe, expect, it } from 'vitest';

import { scrubEvent } from './scrub-event';

const MARKER = 'GEHEIMER-INHALT';

function eventWithContent(): ErrorEvent {
  return {
    type: undefined,
    event_id: 'abc123',
    level: 'error',
    timestamp: 1_700_000_000,
    platform: 'node',
    release: 'sha-1',
    environment: 'production',
    server_name: `host-${MARKER}`,
    message: `Frage: ${MARKER}`,
    logentry: { message: `Frage: ${MARKER}` },
    user: { id: 'u1', email: `${MARKER}@example.test`, ip_address: '1.2.3.4' },
    request: {
      url: `https://example.test/api?q=${MARKER}`,
      headers: { cookie: MARKER },
      data: MARKER,
    },
    extra: { prompt: MARKER },
    breadcrumbs: [{ message: MARKER }],
    contexts: { runtime: { name: 'node', version: 'v24' }, app: { note: MARKER } },
    tags: { requestId: 'r1', stage: 'parse' },
    sdk: { name: 'sentry.javascript.node', version: '11.7.0' },
    exception: {
      values: [
        {
          type: 'IngestError',
          value: `Parser sagte: ${MARKER}`,
          mechanism: { type: 'generic', handled: false },
          stacktrace: {
            frames: [
              {
                filename: '/app/apps/api/dist/index.js',
                function: 'parse',
                lineno: 10,
                colno: 5,
                in_app: true,
                vars: { text: MARKER },
                context_line: `const text = '${MARKER}';`,
                pre_context: [MARKER],
                post_context: [MARKER],
              },
            ],
          },
        },
        { type: 'TypeError', value: `Ursache: ${MARKER}` },
      ],
    },
  };
}

describe('scrubEvent', () => {
  it('sends nothing that could quote a document, a question or a person', () => {
    const scrubbed = scrubEvent(eventWithContent());

    expect(JSON.stringify(scrubbed)).not.toContain(MARKER);
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
  });

  it('keeps what finds the error: kind, place in the code, tags and release', () => {
    const scrubbed = scrubEvent(eventWithContent());

    expect(scrubbed).toMatchObject({
      event_id: 'abc123',
      level: 'error',
      release: 'sha-1',
      environment: 'production',
      tags: { requestId: 'r1', stage: 'parse' },
      contexts: { runtime: { name: 'node' } },
    });
    expect(scrubbed.exception?.values).toEqual([
      {
        type: 'IngestError',
        mechanism: { type: 'generic', handled: false },
        stacktrace: {
          frames: [
            {
              filename: '/app/apps/api/dist/index.js',
              function: 'parse',
              lineno: 10,
              colno: 5,
              in_app: true,
            },
          ],
        },
      },
      { type: 'TypeError' },
    ]);
  });
});
