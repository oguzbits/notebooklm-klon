import { useEffect, useRef } from 'react';

/** A question that comes from elsewhere on the page; its ID counts up, so each is asked once. */
export interface IncomingQuestion {
  id: number;
  question: string;
}

/**
 * Asks a question sent from elsewhere like a typed one. While an answer is being written, or with
 * no source to answer from, it is not asked: the same rule as for the field.
 */
export function useIncomingQuestion(
  incoming: IncomingQuestion | null,
  canAsk: boolean,
  onAsk: (question: string) => void
) {
  const handled = useRef(0);
  useEffect(() => {
    if (!incoming || incoming.id === handled.current) return;
    handled.current = incoming.id;
    if (canAsk) onAsk(incoming.question);
  }, [incoming, canAsk, onAsk]);
}
