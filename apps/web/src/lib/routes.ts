export const ROUTES = {
  SIGN_IN: '/anmelden',
  HOME: '/',
  NOTEBOOK_PATTERN: '/notizbuecher/:notebookId',
  notebook: (notebookId: string) => `/notizbuecher/${notebookId}`,
} as const;
