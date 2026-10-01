import { COLUMN, type Column } from '@/lib/columns';
import { cn } from '@/lib/utils';

const COLUMN_TAB: { column: Column; label: string }[] = [
  { column: COLUMN.SOURCES, label: 'Quellen' },
  { column: COLUMN.CHAT, label: 'Chat' },
  { column: COLUMN.STUDIO, label: 'Studio' },
];

/** The bar under the header that switches the column below the wide layout. */
export function ColumnTabs({
  column,
  onSelect,
}: {
  column: Column;
  onSelect: (column: Column) => void;
}) {
  return (
    <nav
      aria-label="Bereiche"
      className="mx-4 mt-3 mb-3 flex shrink-0 gap-0 rounded-full bg-secondary p-0.5 wide:hidden"
    >
      {COLUMN_TAB.map(({ column: own, label }) => (
        <button
          key={own}
          type="button"
          aria-current={column === own ? 'page' : undefined}
          onClick={() => onSelect(own)}
          className={cn(
            'h-7 flex-1 rounded-full text-ui font-title text-muted-foreground transition-colors',
            column === own && 'bg-card text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
