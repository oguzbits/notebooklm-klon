import { COLUMN } from '@/lib/columns';

/** The columns whose width can be changed; the chat takes what they leave. */
export type SideColumn = typeof COLUMN.SOURCES | typeof COLUMN.STUDIO;

/** No column gets narrower than this (measured in the original, where it is 285 px at any drag). */
export const COLUMN_MIN_PX = 285;
/**
 * The share of the window the Studio asks for while an output is open. The same value stands in
 * `FLEX.STUDIO_VIEWING` (`min-w-[37.5vw]`), which Tailwind needs as a literal class.
 */
export const STUDIO_VIEWING_SHARE = 0.375;
/** The strip between two columns that is dragged. */
export const GUTTER_PX = 8;
/** What a side column measures before it was dragged, in percent of the columns' box. */
export const DEFAULT_SIDE_PERCENT = 25;
/** How far an arrow key moves the edge. */
export const KEY_STEP_PX = 16;
/** The width of a column that is folded into a rail. */
const RAIL_PX = 56;

export interface ColumnsBox {
  left: number;
  width: number;
}

/** The width a side column asks for when its edge is dragged to `pointerX`. */
export function wantedWidth(side: SideColumn, pointerX: number, box: ColumnsBox): number {
  const edge = side === COLUMN.SOURCES ? pointerX - box.left : box.left + box.width - pointerX;
  return edge - GUTTER_PX / 2;
}

/**
 * The width in percent of the box a side column gets when it asks for `wanted` px: not below its
 * own minimum, and not so wide that the chat or the column on the other side drops below theirs.
 * `otherPercent` is that other column's width, or null while it is folded into a rail.
 */
export function sideWidthPercent(options: {
  wanted: number;
  box: ColumnsBox;
  otherPercent: number | null;
  minPx: number;
}): number {
  const { wanted, box, otherPercent, minPx } = options;
  const other = otherPercent === null ? RAIL_PX : (otherPercent / 100) * box.width;
  const maxPx = box.width - other - COLUMN_MIN_PX - 2 * GUTTER_PX;
  const px = Math.min(Math.max(wanted, minPx), Math.max(minPx, maxPx));
  return (px / box.width) * 100;
}

/** The width the Studio may not go below: the usual minimum, or what it asks for while it shows an output. */
export const studioMinPx = (viewingOutput: boolean, windowWidth: number): number =>
  viewingOutput ? Math.max(COLUMN_MIN_PX, windowWidth * STUDIO_VIEWING_SHARE) : COLUMN_MIN_PX;
