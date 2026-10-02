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
      <ChatSkeleton key="2" emoji="📚" />,
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
    expect(boxes(render(<ChatSkeleton emoji="📚" />).container)).toHaveLength(7);
    expect(boxes(render(<OutputRowsSkeleton />).container)).toHaveLength(5);
    expect(boxes(render(<NotebookCardsSkeleton />).container)).toHaveLength(6);
    expect(boxes(render(<SourceRowsSkeleton />).container)).toHaveLength(9);
  });

  // The class is the feature: the cover and its placeholder must be the same size, or the page jumps.
  it('hold the place of the cover in its size, as an empty area and not as a shimmering block', () => {
    const { container } = render(<ChatSkeleton emoji="📚" />);

    const area = container.querySelector(`.${COVER_BOX.split(' ')[0]}`);
    expect(area?.className).toContain(COVER_BOX);
    expect(area?.querySelector('[data-slot="skeleton"]')).toBeNull();
  });

  it('show the symbol and a title in the place of the cover, like the original', () => {
    render(<ChatSkeleton emoji="🔬" />);

    expect(screen.getByText('🔬')).toBeTruthy();
    expect(screen.getByText('Notebook wird geladen …')).toBeTruthy();
  });

  it('show the title of the notebook when it is known', () => {
    render(<ChatSkeleton emoji="🔬" title="Quartalsbericht" />);

    expect(screen.getByText('Quartalsbericht')).toBeTruthy();
  });

  it('show no spinner beside the bars', () => {
    expect(render(<ChatSkeleton emoji="📚" />).container.querySelector('.animate-spin')).toBeNull();
  });

  it('shimmer instead of pulsing', () => {
    const { container } = render(<ChatSkeleton emoji="📚" />);

    const first = boxes(container)[0];
    expect(first?.className).toContain('shimmer');
    expect(first?.className).not.toContain('animate-pulse');
  });
});
