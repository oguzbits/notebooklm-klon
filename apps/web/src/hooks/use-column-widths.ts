import { type CSSProperties, useCallback, useState } from 'react';

import { DEFAULT_SIDE_PERCENT, type SideColumn } from '@/lib/column-widths';
import { COLUMN } from '@/lib/columns';

type Widths = Record<SideColumn, number | null>;
type CssVariables = CSSProperties & Record<`--${string}`, string>;

/**
 * The widths the user gave the side columns by dragging, in percent of the columns' box. Like in the
 * original they last as long as the notebook is open. A folded column keeps its width for later.
 */
export function useColumnWidths(folded: Record<SideColumn, boolean>) {
  const [widths, setWidths] = useState<Widths>({ [COLUMN.SOURCES]: null, [COLUMN.STUDIO]: null });
  const [resizing, setResizing] = useState(false);
  const resize = useCallback(
    (side: SideColumn, percent: number) =>
      setWidths((current) => ({ ...current, [side]: percent })),
    []
  );
  const percent = (side: SideColumn) => widths[side] ?? DEFAULT_SIDE_PERCENT;
  const otherSide = (side: SideColumn) =>
    side === COLUMN.SOURCES ? COLUMN.STUDIO : COLUMN.SOURCES;

  const variables: CssVariables = {
    '--sources-width': `${percent(COLUMN.SOURCES)}%`,
    '--studio-width': `${percent(COLUMN.STUDIO)}%`,
  };

  return {
    folded,
    resizing,
    setResizing,
    resize,
    percent,
    /** The width of the column on the other side of the chat, or null while that one is folded. */
    otherPercent: (side: SideColumn) => (folded[otherSide(side)] ? null : percent(otherSide(side))),
    /** True once a side column has a width of its own; the chat is then what is left. */
    resized: widths.SOURCES !== null || widths.STUDIO !== null,
    /** The widths as CSS variables for the columns' box. */
    variables,
  };
}
