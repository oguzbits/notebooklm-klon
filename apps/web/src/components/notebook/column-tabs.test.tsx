import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { COLUMN, type Column } from '@/lib/columns';

import { ColumnTabs } from './column-tabs';

function Harness({ start = COLUMN.CHAT }: { start?: Column }) {
  const [column, setColumn] = useState<Column>(start);
  return <ColumnTabs column={column} onSelect={setColumn} />;
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('ColumnTabs', () => {
  it('is a list of tabs with the current column selected and only that one in the tab order', () => {
    render(<Harness />);

    expect(screen.getByRole('tablist', { name: 'Bereiche' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((own) => own.textContent)).toEqual([
      'Quellen',
      'Chat',
      'Studio',
    ]);
    expect(tab('Chat').getAttribute('aria-selected')).toBe('true');
    expect(tab('Quellen').getAttribute('aria-selected')).toBe('false');
    expect(tab('Chat')).toHaveProperty('tabIndex', 0);
    expect(tab('Quellen')).toHaveProperty('tabIndex', -1);
    expect(tab('Studio')).toHaveProperty('tabIndex', -1);
  });

  it('selects a column on click', async () => {
    render(<Harness />);

    await userEvent.click(tab('Studio'));

    expect(tab('Studio').getAttribute('aria-selected')).toBe('true');
    expect(tab('Chat').getAttribute('aria-selected')).toBe('false');
  });

  it('moves between the tabs with the arrow keys, around the ends, and takes the focus along', async () => {
    render(<Harness />);
    tab('Chat').focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Studio').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Studio'));

    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Quellen').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('Quellen'));

    await userEvent.keyboard('{ArrowLeft}');
    expect(tab('Studio').getAttribute('aria-selected')).toBe('true');
  });

  it('jumps to the first and the last tab with Home and End', async () => {
    render(<Harness />);
    tab('Chat').focus();

    await userEvent.keyboard('{End}');
    expect(tab('Studio').getAttribute('aria-selected')).toBe('true');

    await userEvent.keyboard('{Home}');
    expect(tab('Quellen').getAttribute('aria-selected')).toBe('true');
  });
});
