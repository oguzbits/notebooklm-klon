import { useRef } from 'react';

/**
 * Whether the mouse or the focus is on an element, to put in the way of a hover card. The card starts
 * one timer for the mouse and another for the focus and forgets the first when it clears them, so it
 * could open after both had left. It may only open while `isPresent()` is true.
 */
export function useHoverOrFocus() {
  const pointer = useRef(false);
  const focus = useRef(false);
  return {
    isPresent: () => pointer.current || focus.current,
    onPointerEnter: () => (pointer.current = true),
    onPointerLeave: () => (pointer.current = false),
    onFocus: () => (focus.current = true),
    onBlur: () => (focus.current = false),
  };
}
