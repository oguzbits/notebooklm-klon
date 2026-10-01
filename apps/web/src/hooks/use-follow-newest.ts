import { useEffect, useRef } from 'react';

/**
 * Keeps the end of a conversation in view as it grows: a message more, a statement more while an
 * answer is written, and when the answer is done. Put the returned ref on an element at the end.
 */
export function useFollowNewest({
  messages,
  statements,
  pending,
}: {
  messages: number | undefined;
  statements: number;
  pending: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, statements, pending]);
  return end;
}
