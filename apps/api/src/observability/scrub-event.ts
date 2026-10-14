import type { ErrorEvent, Exception, StackFrame } from '@sentry/node';

function scrubFrame(frame: StackFrame): StackFrame {
  // No variables and no lines of code around the frame: a variable can hold document content.
  return {
    filename: frame.filename,
    function: frame.function,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
  };
}

function scrubException(exception: Exception): Exception {
  // No message: that of a provider or parser error could quote the document. The class name and the
  // tags (step, source ID) say what happened.
  return {
    type: exception.type,
    mechanism: exception.mechanism,
    stacktrace: exception.stacktrace && {
      frames: exception.stacktrace.frames?.map(scrubFrame),
    },
  };
}

/**
 * What leaves the server is built from a list of allowed fields, not cleaned from a list of forbidden
 * ones: a field a later SDK version adds (request, user, breadcrumbs, a message) is dropped until it
 * is allowed here on purpose.
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
    tags: event.tags,
    sdk: event.sdk,
    contexts: event.contexts?.runtime && { runtime: event.contexts.runtime },
    exception: event.exception && { values: event.exception.values?.map(scrubException) },
  };
}
