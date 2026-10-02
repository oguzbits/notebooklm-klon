import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ColumnGutter } from '@/components/notebook/column-gutter';
import {
  COLUMN_MIN_PX,
  DEFAULT_SIDE_PERCENT,
  KEY_STEP_PX,
  type SideColumn,
} from '@/lib/column-widths';
import { COLUMN } from '@/lib/columns';

// jsdom has no layout: the box of the columns is the one of the original at 1720 px.
const BOX = { left: 12, width: 1696 };

beforeEach(() => {
  // jsdom has no pointer events; a mouse event carries the coordinates the strip reads.
  vi.stubGlobal('PointerEvent', MouseEvent);
});
afterEach(() => vi.unstubAllGlobals());

function renderGutter(side: SideColumn = COLUMN.SOURCES, folded = false) {
  const onResize = vi.fn();
  const onResizing = vi.fn();
  const columns: React.ComponentProps<typeof ColumnGutter>['columns'] = {
    folded: { [COLUMN.SOURCES]: folded, [COLUMN.STUDIO]: false },
    resizing: false,
    setResizing: onResizing,
    resize: onResize,
    percent: () => DEFAULT_SIDE_PERCENT,
    otherPercent: () => DEFAULT_SIDE_PERCENT,
    resized: false,
    variables: { '--sources-width': '25%', '--studio-width': '25%' },
  };
  render(
    <div
      ref={(box) => {
        if (box) box.getBoundingClientRect = () => ({ ...BOX, x: BOX.left }) as DOMRect;
      }}
    >
      <ColumnGutter side={side} columns={columns} minPx={COLUMN_MIN_PX} />
    </div>
  );
  return { onResize, onResizing, strip: screen.queryByRole('separator') };
}

/** The width in px of the nth resize the strip reported (it reports percent). */
const widthAfter = (onResize: ReturnType<typeof vi.fn>, nth: number) => {
  const percent: unknown = onResize.mock.calls[nth]?.[1];
  if (typeof percent !== 'number') throw new Error('no resize reported');
  return (percent / 100) * BOX.width;
};

describe('ColumnGutter', () => {
  it('is a separator that names its column and its width', () => {
    const { strip } = renderGutter();

    expect(strip?.getAttribute('aria-label')).toBe('Breite der Quellen ändern');
    expect(strip?.getAttribute('aria-valuenow')).toBe('25');
  });

  it('widens the sources with the right arrow key and narrows them with the left one', async () => {
    const { onResize, strip } = renderGutter();
    strip?.focus();

    await userEvent.setup().keyboard('{ArrowRight}{ArrowLeft}');

    const start = (DEFAULT_SIDE_PERCENT / 100) * BOX.width;
    expect(onResize).toHaveBeenNthCalledWith(1, COLUMN.SOURCES, expect.any(Number));
    expect(widthAfter(onResize, 0)).toBeCloseTo(start + KEY_STEP_PX);
    expect(widthAfter(onResize, 1)).toBeCloseTo(start - KEY_STEP_PX);
  });

  it('moves the edge of the Studio the other way round', async () => {
    const { onResize, strip } = renderGutter(COLUMN.STUDIO);
    strip?.focus();

    await userEvent.setup().keyboard('{ArrowLeft}');

    expect(widthAfter(onResize, 0)).toBeCloseTo(
      (DEFAULT_SIDE_PERCENT / 100) * BOX.width + KEY_STEP_PX
    );
  });

  it('follows the pointer while it is dragged and stops when it is let go', () => {
    const { onResize, onResizing, strip } = renderGutter();
    if (!strip) throw new Error('no strip');

    fireEvent.pointerMove(strip, { clientX: 600 });
    expect(onResize).not.toHaveBeenCalled();

    fireEvent.pointerDown(strip, { clientX: 436 });
    fireEvent.pointerMove(strip, { clientX: 600 });
    fireEvent.pointerUp(strip, { clientX: 600 });
    fireEvent.pointerMove(strip, { clientX: 700 });

    expect(onResizing.mock.calls).toEqual([[true], [false]]);
    expect(onResize).toHaveBeenCalledOnce();
    expect(widthAfter(onResize, 0)).toBeCloseTo(600 - BOX.left - 4);
  });

  it('is not a control while its column is folded, and only keeps the space', () => {
    const { strip, onResize } = renderGutter(COLUMN.SOURCES, true);

    expect(strip).toBeNull();
    expect(onResize).not.toHaveBeenCalled();
  });
});
