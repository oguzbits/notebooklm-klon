import { describe, expect, it } from 'vitest';

import {
  COLUMN_MIN_PX,
  DEFAULT_SIDE_PERCENT,
  GUTTER_PX,
  sideWidthPercent,
  wantedWidth,
} from '@/lib/column-widths';
import { COLUMN } from '@/lib/columns';

// The box of the original at 1720 px: 12 px of margin on each side.
const BOX = { left: 12, width: 1696 };
const px = (percent: number) => (percent / 100) * BOX.width;

describe('wantedWidth', () => {
  it('measures the sources from the left edge and the Studio from the right, to the middle of the strip', () => {
    expect(wantedWidth(COLUMN.SOURCES, 452, BOX)).toBe(452 - BOX.left - GUTTER_PX / 2);
    expect(wantedWidth(COLUMN.STUDIO, 1256, BOX)).toBe(BOX.left + BOX.width - 1256 - GUTTER_PX / 2);
  });
});

describe('sideWidthPercent', () => {
  const resize = (wanted: number, otherPercent: number | null = DEFAULT_SIDE_PERCENT) =>
    px(sideWidthPercent({ wanted, box: BOX, otherPercent, minPx: COLUMN_MIN_PX }));

  it('follows the pointer inside the limits', () => {
    expect(resize(500)).toBeCloseTo(500);
  });

  it('never goes below the minimum width', () => {
    expect(resize(0)).toBeCloseTo(COLUMN_MIN_PX);
    expect(resize(-300)).toBeCloseTo(COLUMN_MIN_PX);
  });

  it('leaves the chat and the other side column their minimum width', () => {
    const other = px(DEFAULT_SIDE_PERCENT);
    expect(resize(5000)).toBeCloseTo(BOX.width - other - COLUMN_MIN_PX - 2 * GUTTER_PX);
  });

  it('leaves the room of a rail when the other side is folded', () => {
    expect(resize(5000, null)).toBeCloseTo(BOX.width - 56 - COLUMN_MIN_PX - 2 * GUTTER_PX);
  });

  it('respects a larger own minimum (the Studio while an output is open)', () => {
    const percent = sideWidthPercent({
      wanted: 100,
      box: BOX,
      otherPercent: DEFAULT_SIDE_PERCENT,
      minPx: 645,
    });
    expect(px(percent)).toBeCloseTo(645);
  });
});
