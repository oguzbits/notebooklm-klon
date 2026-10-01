import { type PointerEvent, useRef } from 'react';

/** Where a drag began, and how far the area was scrolled then. */
interface DragStart {
  x: number;
  y: number;
  left: number;
  top: number;
}

/**
 * Lets an area be moved by dragging its empty ground; put the handlers on the area. A node or a
 * button inside (anything that matches `ignore`) is for clicking, so a drag that starts on one does
 * nothing.
 */
export function useDragScroll(ignore: string) {
  const start = useRef<DragStart | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest(ignore)) return;
    const box = event.currentTarget;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      left: box.scrollLeft,
      top: box.scrollTop,
    };
    box.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const from = start.current;
    if (!from) return;
    event.currentTarget.scrollTo({
      left: from.left - (event.clientX - from.x),
      top: from.top - (event.clientY - from.y),
    });
  };
  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    start.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd };
}
