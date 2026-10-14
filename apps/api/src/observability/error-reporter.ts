import type { NodeOptions } from '@sentry/node';

import type { ErrorOrigin } from './error-origin';
import { scrubEvent } from './scrub-event';

const FLUSH_TIMEOUT_MS = 2000;

/** What helps to find the error. IDs and names only: never a message or content. */
export interface ErrorTags {
  origin: ErrorOrigin;
  requestId?: string;
  sourceId?: string;
  stage?: string;
  code?: string;
}

export interface ErrorReporter {
  report: (error: unknown, tags: ErrorTags) => void;
  /** Waits until what was reported has left the process: call it before the process ends. */
  flush: () => Promise<void>;
}

/** The part of the Sentry SDK the reporter uses, so a test does not need a network. */
export interface ReporterSdk {
  init(
    options: Pick<
      NodeOptions,
      'dsn' | 'release' | 'environment' | 'dataCollection' | 'beforeSend' | 'beforeBreadcrumb'
    >
  ): unknown;
  captureException(error: unknown, hint?: { tags?: Record<string, string> }): string;
  flush(timeout: number): Promise<boolean>;
}

export interface ErrorReportingConfig {
  /** Unset: nothing is started and nothing is sent. */
  dsn: string | undefined;
  environment: string;
  release?: string;
}

const NOTHING: ErrorReporter = { report: () => undefined, flush: async () => undefined };

function definedTags(tags: ErrorTags): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tags).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

/**
 * Reports errors to Sentry. Only unexpected failures belong here: the ones the app maps to a status
 * the user caused (limit reached, not found) are not errors of the app.
 */
export function createErrorReporter(config: ErrorReportingConfig, sdk: ReporterSdk): ErrorReporter {
  if (!config.dsn) return NOTHING;

  sdk.init({
    dsn: config.dsn,
    release: config.release,
    environment: config.environment,
    // Since SDK 11 the defaults of `dataCollection` apply on their own (there is no sendDefaultPii any
    // more): everything is switched off here, one by one.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    beforeBreadcrumb: () => null,
    beforeSend: scrubEvent,
  });

  return {
    report: (error, tags) => {
      sdk.captureException(error, { tags: definedTags(tags) });
    },
    flush: async () => {
      await sdk.flush(FLUSH_TIMEOUT_MS);
    },
  };
}
