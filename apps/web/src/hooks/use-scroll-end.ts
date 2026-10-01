import { useRef, useState } from 'react';

/** How far from the end (in px) a scroll area may be and still count as being at its end. */
const END_TOLERANCE = 48;

/** Whether a scroll area is at its end, and a way to take it there smoothly. */
export function useScrollEnd() {
  const scroller = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(true);

  const trackEnd = () => {
    const area = scroller.current;
    if (!area) return;
    setAtEnd(area.scrollHeight - area.scrollTop - area.clientHeight <= END_TOLERANCE);
  };

  const jumpToEnd = () => {
    const area = scroller.current;
    area?.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
  };

  return { scroller, atEnd, trackEnd, jumpToEnd };
}
