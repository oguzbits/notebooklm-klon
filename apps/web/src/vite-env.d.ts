/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where errors of the browser are reported (Sentry). Unset or blank: nothing is sent. */
  readonly VITE_SENTRY_DSN?: string;
  /** Names the build in Sentry (the commit). */
  readonly VITE_SENTRY_RELEASE?: string;
}
