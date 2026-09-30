/** Every TanStack Query key in one place, so a mutation can invalidate exactly what it changed. */
export const queryKeys = {
  session: ['session'] as const,
  notebooks: ['notebooks'] as const,
  sources: (notebookId: string) => ['notebooks', notebookId, 'sources'] as const,
  messages: (notebookId: string) => ['notebooks', notebookId, 'messages'] as const,
  chunk: (notebookId: string, chunkId: string) =>
    ['notebooks', notebookId, 'chunks', chunkId] as const,
  overview: (notebookId: string, sourceId: string) =>
    ['notebooks', notebookId, 'sources', sourceId, 'overview'] as const,
  sourceText: (notebookId: string, sourceId: string) =>
    ['notebooks', notebookId, 'sources', sourceId, 'text'] as const,
};
