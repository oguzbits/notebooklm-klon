import { useEffect, useRef, useState } from 'react';

/** A question that comes from elsewhere on the page; its ID counts up, so each is asked once. */
export interface IncomingQuestion {
  id: number;
  question: string;
}

/**
 * Asks a question sent from elsewhere like a typed one. While an answer is being written it waits
 * and is asked right after, so it is not lost. With no source to answer from it is not asked at
 * all; the result says so, so the page can tell the person (a question that waited for a source
 * would surprise them when one is chosen much later).
 */
export function useIncomingQuestion(
  incoming: IncomingQuestion | null,
  { hasSource, pending }: { hasSource: boolean; pending: boolean },
  onAsk: (question: string) => void
): { dropped: boolean } {
  const handled = useRef(0);
  // Set while rendering, as React allows for the state of the component itself: no extra render pass.
  const [droppedId, setDroppedId] = useState(0);
  if (incoming && !hasSource && incoming.id !== droppedId) setDroppedId(incoming.id);

  useEffect(() => {
    if (!incoming || incoming.id === handled.current || incoming.id === droppedId) return;
    if (!hasSource || pending) return;
    handled.current = incoming.id;
    onAsk(incoming.question);
  }, [incoming, droppedId, hasSource, pending, onAsk]);
  return { dropped: incoming !== null && incoming.id === droppedId };
}
