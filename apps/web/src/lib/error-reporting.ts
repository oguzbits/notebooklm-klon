import type { BrowserOptions, ErrorEvent, Exception, StackFrame } from '@sentry/react';

function scrubFrame(frame: StackFrame): StackFrame {
  return {
    filename: frame.filename,
    function: frame.function,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
  };
}

function scrubException(exception: Exception): Exception {
  // No message: it could quote a note, a source or a question that is on the screen.
  return {
    type: exception.type,
    mechanism: exception.mechanism,
    stacktrace: exception.stacktrace && { frames: exception.stacktrace.frames?.map(scrubFrame) },
  };
}

/**
 * What leaves the browser is built from a list of allowed fields (see the same function of the API):
 * no address (it holds notebook IDs), no user, no breadcrumbs (they hold the text of clicked elements).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    environment: event.environment,
    sdk: event.sdk,
    exception: event.exception && { values: event.exception.values?.map(scrubException) },
  };
}

/** The part of the Sentry SDK that is used, so a test needs no network. */
export interface ReportingSdk {
  init(
    options: Pick<
      BrowserOptions,
      'dsn' | 'release' | 'environment' | 'beforeSend' | 'beforeBreadcrumb'
    >
  ): unknown;
}

export interface ErrorReportingConfig {
  /** Unset or blank: nothing is started and nothing is sent. */
  dsn: string | undefined;
  environment: string;
  release?: string;
}

/** Starts the reporting of errors of the browser. Returns whether it is on. */
export function startErrorReporting(config: ErrorReportingConfig, sdk: ReportingSdk): boolean {
  if (!config.dsn) return false;
  sdk.init({
    dsn: config.dsn,
    release: config.release,
    environment: config.environment,
    beforeBreadcrumb: () => null,
    beforeSend: scrubEvent,
  });
  return true;
}
