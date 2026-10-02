import { type KeyboardEvent, type PointerEvent, useRef } from 'react';

import { useColumnWidths } from '@/hooks/use-column-widths';
import { KEY_STEP_PX, type SideColumn, sideWidthPercent, wantedWidth } from '@/lib/column-widths';
import { COLUMN } from '@/lib/columns';
import { cn } from '@/lib/utils';

interface ColumnGutterProps {
  /** The side column whose edge this strip moves. */
  side: SideColumn;
  columns: ReturnType<typeof useColumnWidths>;
  /** The least width that column may get (more than the usual while the Studio shows an output). */
  minPx: number;
}

const LABEL = {
  [COLUMN.SOURCES]: 'Breite der Quellen ändern',
  [COLUMN.STUDIO]: 'Breite des Studios ändern',
} as const;

const GUTTER = 'max-wide:hidden w-2 shrink-0 touch-none rounded-full outline-none';
const HORIZONTAL_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

/**
 * The 8 px strip between two columns, like in the original: invisible, with a resize cursor, and
 * dragged to give one side column more or less of the room. It also works from the keyboard (arrow
 * keys) and says so to a screen reader as a separator with its width.
 */
export function ColumnGutter({ side, columns, minPx }: ColumnGutterProps) {
  const dragging = useRef(false);
  const { resize, setResizing, folded } = columns;
  const percent = columns.percent(side);
  const otherPercent = columns.otherPercent(side);

  const resizeTo = (box: DOMRect, wanted: number) =>
    resize(side, sideWidthPercent({ wanted, box, otherPercent, minPx }));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!dragging.current || !box) return;
    resizeTo(box, wantedWidth(side, event.clientX, box));
  };
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setResizing(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!HORIZONTAL_KEYS.has(event.key) || !box) return;
    event.preventDefault();
    // The strip moves with the arrow: right makes the sources wider and the Studio narrower.
    const toward = (event.key === 'ArrowRight' ? 1 : -1) * (side === COLUMN.SOURCES ? 1 : -1);
    resizeTo(box, (percent / 100) * box.width + toward * KEY_STEP_PX);
  };

  if (folded[side]) return <div aria-hidden className={cn(GUTTER, 'pointer-events-none')} />;

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={LABEL[side]}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      className={cn(GUTTER, 'cursor-col-resize focus-visible:outline-3 focus-visible:outline-ring')}
    />
  );
}
