import { CitationChip } from '@/components/chat/citation-chip';

/** The numbered chips of the passages behind one item, in the order they are listed. */
export function CitedBy({
  notebookId,
  chunkIds,
  onOpen,
}: {
  notebookId: string;
  chunkIds: string[];
  onOpen: (chunkId: string) => void;
}) {
  return [...new Set(chunkIds)].map((chunkId, index) => (
    <CitationChip
      key={chunkId}
      notebookId={notebookId}
      chunkId={chunkId}
      number={index + 1}
      onOpen={onOpen}
    />
  ));
}
