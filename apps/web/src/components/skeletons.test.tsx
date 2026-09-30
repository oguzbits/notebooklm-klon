import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ChatSkeleton,
  DialogSpinner,
  NotebookCardsSkeleton,
  OutputRowsSkeleton,
  PageSpinner,
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
      <PageSpinner key="5" />,
      <DialogSpinner key="6" />,
    ]) {
      const { unmount } = render(ui);
      expect(screen.getByRole('status', { name: 'Wird geladen' })).toBeTruthy();
      unmount();
    }
  });

  it('have the number of parts the original shows', () => {
    expect(boxes(render(<ChatSkeleton />).container)).toHaveLength(7);
    expect(boxes(render(<OutputRowsSkeleton />).container)).toHaveLength(5);
    expect(boxes(render(<NotebookCardsSkeleton />).container)).toHaveLength(6);
    expect(boxes(render(<SourceRowsSkeleton />).container)).toHaveLength(9);
  });

  it('shimmer instead of pulsing', () => {
    const { container } = render(<ChatSkeleton />);

    const first = boxes(container)[0];
    expect(first?.className).toContain('shimmer');
    expect(first?.className).not.toContain('animate-pulse');
  });
});
