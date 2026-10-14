import { describe, expect, it } from 'vitest';

import { type ReportingSdk, scrubEvent, startErrorReporting } from './error-reporting';

const MARKER = 'GEHEIMER-INHALT';

describe('startErrorReporting', () => {
  it('does not start without a DSN, also not with a blank one', () => {
    const started: unknown[] = [];
    const sdk: ReportingSdk = { init: (options) => started.push(options) };

    expect(startErrorReporting({ dsn: undefined, environment: 'production' }, sdk)).toBe(false);
    expect(startErrorReporting({ dsn: '', environment: 'production' }, sdk)).toBe(false);
    expect(started).toEqual([]);
  });

  it('starts with a DSN and drops the breadcrumbs, which hold the text of clicked elements', () => {
    const started: Parameters<ReportingSdk['init']>[0][] = [];
    const sdk: ReportingSdk = { init: (options) => started.push(options) };

    const on = startErrorReporting(
      { dsn: 'https://key@example.test/1', environment: 'production', release: 'sha-1' },
      sdk
    );

    expect(on).toBe(true);
    expect(started[0]).toMatchObject({ dsn: 'https://key@example.test/1', release: 'sha-1' });
    expect(started[0]?.beforeBreadcrumb?.({ message: MARKER }, undefined)).toBeNull();
    expect(started[0]?.beforeSend).toBe(scrubEvent);
  });
});

describe('scrubEvent', () => {
  it('sends the kind of error and its place in the code, but no text from the page', () => {
    const scrubbed = scrubEvent({
      type: undefined,
      event_id: 'e1',
      level: 'error',
      release: 'sha-1',
      message: MARKER,
      debug_meta: {
        images: [{ type: 'sourcemap', code_file: '/assets/index.js', debug_id: 'abc-123' }],
      },
      user: { ip_address: '1.2.3.4' },
      request: { url: `https://example.test/notebooks/${MARKER}`, headers: { cookie: MARKER } },
      breadcrumbs: [{ category: 'ui.click', message: MARKER }],
      contexts: { react: { componentStack: MARKER } },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: `Cannot read ${MARKER}`,
            stacktrace: {
              frames: [
                { filename: '/assets/index.js', function: 'f', lineno: 1, vars: { a: MARKER } },
              ],
            },
          },
        ],
      },
    });

    expect(JSON.stringify(scrubbed)).not.toContain(MARKER);
    expect(scrubbed.exception?.values?.[0]).toEqual({
      type: 'TypeError',
      stacktrace: { frames: [{ filename: '/assets/index.js', function: 'f', lineno: 1 }] },
    });
    expect(scrubbed).toMatchObject({ event_id: 'e1', release: 'sha-1' });
    // Without these IDs Sentry cannot find the source map, and a frame shows minified code.
    expect(scrubbed.debug_meta?.images).toEqual([
      { type: 'sourcemap', code_file: '/assets/index.js', debug_id: 'abc-123' },
    ]);
  });
});
