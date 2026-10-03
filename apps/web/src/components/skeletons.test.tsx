import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ChatSkeleton,
  DialogSpinner,
  NotebookCardsSkeleton,
  OutputRowsSkeleton,
  PageBlank,
  SourceRowsSkeleton,
} from './skeletons';

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

  it('show the symbol and a title in the place of the cover, like the original', () => {
    render(<ChatSkeleton emoji="🔬" />);

    expect(screen.getByText('🔬')).toBeTruthy();
    expect(screen.getByText('Notebook wird geladen …')).toBeTruthy();
  });

  it('show the title of the notebook when it is known', () => {
    render(<ChatSkeleton emoji="🔬" title="Quartalsbericht" />);

    expect(screen.getByText('Quartalsbericht')).toBeTruthy();
  });
});
