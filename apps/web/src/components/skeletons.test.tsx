import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ChatSkeleton,
  COVER_BOX,
  DialogSpinner,
  NotebookCardsSkeleton,
  OutputRowsSkeleton,
  PageBlank,
  SourceRowsSkeleton,
} from './skeletons';

const boxes = (container: HTMLElement) => container.querySelectorAll('[data-slot="skeleton"]');

describe('the placeholders', () => {
  it('announce themselves as loading', () => {
    for (const ui of [
      <SourceRowsSkeleton key="1" />,
      <ChatSkeleton key="2" />,
      <OutputRowsSkeleton key="3" />,
      <NotebookCardsSkeleton key="4" />,
      <PageBlank key="5" />,
      <DialogSpinner key="6" />,
    ]) {
      const { unmount } = render(ui);
      expect(screen.getByRole('status', { name: 'Wird geladen' })).toBeTruthy();
      unmount();
    }
  });

  it('have the number of parts the original shows', () => {
    expect(boxes(render(<ChatSkeleton />).container)).toHaveLength(8);
    expect(boxes(render(<OutputRowsSkeleton />).container)).toHaveLength(5);
    expect(boxes(render(<NotebookCardsSkeleton />).container)).toHaveLength(6);
    expect(boxes(render(<SourceRowsSkeleton />).container)).toHaveLength(9);
  });

  // The class is the feature: the cover and its placeholder must be the same size, or the page jumps.
  it('hold a place for the cover of the notebook before the summary, in the size of the cover', () => {
    const { container } = render(<ChatSkeleton />);

    expect(boxes(container)[0]?.className).toContain(COVER_BOX);
  });

  it('show no spinner beside the bars', () => {
    expect(render(<ChatSkeleton />).container.querySelector('.animate-spin')).toBeNull();
  });

  it('shimmer instead of pulsing', () => {
    const { container } = render(<ChatSkeleton />);

    const first = boxes(container)[0];
    expect(first?.className).toContain('shimmer');
    expect(first?.className).not.toContain('animate-pulse');
  });
});
