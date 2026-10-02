import type { KeyboardEvent } from 'react';

import { COLUMN, type Column } from '@/lib/columns';
import { cn } from '@/lib/utils';

const COLUMN_TAB: { column: Column; label: string }[] = [
  { column: COLUMN.SOURCES, label: 'Quellen' },
  { column: COLUMN.CHAT, label: 'Chat' },
  { column: COLUMN.STUDIO, label: 'Studio' },
];

/** Where an arrow key or Home/End leads from a tab: the tabs go round at their ends. */
function targetTab(key: string, index: number): number | null {
  const last = COLUMN_TAB.length - 1;
  if (key === 'ArrowRight') return index === last ? 0 : index + 1;
  if (key === 'ArrowLeft') return index === 0 ? last : index - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return null;
}

/** The bar under the header that switches the column below the wide layout. */
export function ColumnTabs({
  column,
  onSelect,
}: {
  column: Column;
  onSelect: (column: Column) => void;
}) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = targetTab(event.key, index);
    const next = target === null ? undefined : COLUMN_TAB[target];
    if (target === null || !next) return;
    event.preventDefault();
    onSelect(next.column);
    // The tab that is selected is the only one in the tab order, so the focus goes there with it.
    const tabs = event.currentTarget.parentElement?.children;
    if (tabs?.[target] instanceof HTMLElement) tabs[target].focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Bereiche"
      className="mx-4 mt-3 mb-3 flex shrink-0 gap-0 rounded-full bg-secondary p-0.5 wide:hidden"
    >
      {COLUMN_TAB.map(({ column: own, label }, index) => (
        <button
          key={own}
          type="button"
          role="tab"
          aria-selected={column === own}
          tabIndex={column === own ? 0 : -1}
          onClick={() => onSelect(own)}
          onKeyDown={(event) => move(event, index)}
          className={cn(
            'min-h-11 flex-1 rounded-full text-ui font-title text-muted-foreground transition-colors',
            column === own && 'bg-card text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
