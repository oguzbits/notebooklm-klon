/** Where in the app a reported error came from. It is a tag in Sentry, so errors can be filtered by it. */
export const ERROR_ORIGIN = {
  REQUEST: 'request',
  INGESTION: 'ingestion',
  QUEUE: 'queue',
  CHAT: 'chat',
} as const;

export type ErrorOrigin = (typeof ERROR_ORIGIN)[keyof typeof ERROR_ORIGIN];
