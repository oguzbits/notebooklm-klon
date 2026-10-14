import { describe, expect, it } from 'vitest';

import { ERROR_ORIGIN } from './error-origin';
import { createErrorReporter, type ReporterSdk } from './error-reporter';

function fakeSdk() {
  const calls = {
    init: [] as Parameters<ReporterSdk['init']>[0][],
    captured: [] as { error: unknown; tags: Record<string, string> | undefined }[],
    flushed: [] as number[],
  };
  const sdk: ReporterSdk = {
    init: (options) => {
      calls.init.push(options);
    },
    captureException: (error, hint) => {
      calls.captured.push({ error, tags: hint?.tags });
      return 'id';
    },
    flush: async (timeout) => {
      calls.flushed.push(timeout);
      return true;
    },
  };
  return { sdk, calls };
}

describe('createErrorReporter', () => {
  it('does nothing without a DSN: no start, nothing sent', async () => {
    const { sdk, calls } = fakeSdk();
    const reporter = createErrorReporter({ dsn: undefined, environment: 'production' }, sdk);

    reporter.report(new Error('x'), { origin: ERROR_ORIGIN.REQUEST });
    await reporter.flush();

    expect(calls).toEqual({ init: [], captured: [], flushed: [] });
  });

  it('sends the error with its tags once a DSN is set', () => {
    const { sdk, calls } = fakeSdk();
    const reporter = createErrorReporter(
      { dsn: 'https://key@example.test/1', environment: 'production', release: 'sha-1' },
      sdk
    );
    const error = new Error('x');

    reporter.report(error, { origin: ERROR_ORIGIN.INGESTION, sourceId: 's1', stage: 'parse' });

    expect(calls.captured).toEqual([
      { error, tags: { origin: ERROR_ORIGIN.INGESTION, sourceId: 's1', stage: 'parse' } },
    ]);
    expect(calls.init[0]).toMatchObject({ dsn: 'https://key@example.test/1', release: 'sha-1' });
  });

  it('starts the SDK so that it adds no personal data and scrubs every event', () => {
    const { sdk, calls } = fakeSdk();
    createErrorReporter({ dsn: 'https://key@example.test/1', environment: 'production' }, sdk);
    const options = calls.init[0];

    expect(options?.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
    expect(options?.beforeBreadcrumb?.({ message: 'x' }, undefined)).toBeNull();
    const sent = options?.beforeSend?.(
      { type: undefined, message: 'Frage: GEHEIM', event_id: 'e' },
      {}
    );
    expect(JSON.stringify(sent)).not.toContain('GEHEIM');
  });

  it('waits for the transport on flush, so a restart does not lose the last error', async () => {
    const { sdk, calls } = fakeSdk();
    const reporter = createErrorReporter(
      { dsn: 'https://key@example.test/1', environment: 'production' },
      sdk
    );

    await reporter.flush();

    expect(calls.flushed).toHaveLength(1);
  });
});
