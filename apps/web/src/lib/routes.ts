export const ROUTES = {
  SIGN_IN: '/anmelden',
  HOME: '/',
  NOTEBOOK_PATTERN: '/notebook/:notebookId',
  /** The address before the rename; it only redirects, so saved links keep working. */
  LEGACY_NOTEBOOK_PATTERN: '/notizbuecher/:notebookId',
  notebook: (notebookId: string) => `/notebook/${notebookId}`,
} as const;
