/** Every TanStack Query key in one place, so a mutation can invalidate exactly what it changed. */
export const queryKeys = {
  session: ['session'] as const,
  capabilities: ['capabilities'] as const,
  notebooks: ['notebooks'] as const,
  sources: (notebookId: string) => ['notebooks', notebookId, 'sources'] as const,
  messages: (notebookId: string) => ['notebooks', notebookId, 'messages'] as const,
  notes: (notebookId: string) => ['notebooks', notebookId, 'notes'] as const,
  studio: (notebookId: string) => ['notebooks', notebookId, 'studio'] as const,
  chatConfig: (notebookId: string) => ['notebooks', notebookId, 'chat-config'] as const,
  chunk: (notebookId: string, chunkId: string) =>
    ['notebooks', notebookId, 'chunks', chunkId] as const,
  // The key of the sources it was made from is part of it: other sources, another overview.
  notebookOverview: (notebookId: string, sourcesKey: string) =>
    ['notebooks', notebookId, 'overview', sourcesKey] as const,
  overview: (notebookId: string, sourceId: string) =>
    ['notebooks', notebookId, 'sources', sourceId, 'overview'] as const,
  sourceText: (notebookId: string, sourceId: string) =>
    ['notebooks', notebookId, 'sources', sourceId, 'text'] as const,
};
