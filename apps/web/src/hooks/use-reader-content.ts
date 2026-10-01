import { useChunk, useSourceText } from '@/hooks/use-reader';
import type { ReaderTarget } from '@/lib/reader-target';

/**
 * What the reader needs for its target: the text of the source, and for a cited passage the place in
 * it to mark. A passage is looked up first, because it says which source it belongs to.
 */
export function useReaderContent(notebookId: string, target: ReaderTarget) {
  const byPassage = 'chunkId' in target;
  const chunk = useChunk(notebookId, byPassage ? target.chunkId : '', byPassage);
  const sourceId = byPassage ? (chunk.data?.sourceId ?? null) : target.sourceId;
  const source = useSourceText(notebookId, sourceId);
  const passage = byPassage ? chunk.data : undefined;

  return {
    chunk,
    source,
    highlight: passage ? { start: passage.startOffset, end: passage.endOffset } : null,
    failed: chunk.isError || source.isError,
  };
}
