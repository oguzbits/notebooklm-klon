import { ArrowDownWideNarrow } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SOURCE_SORT, type SourceSort, toSourceSort } from '@/lib/sort-sources';

const SORT_CHOICES = [
  [SOURCE_SORT.LATEST, 'Letzte'],
  [SOURCE_SORT.TITLE, 'Titel'],
  [SOURCE_SORT.TYPE, 'Typ'],
] as const;

interface SourcesToolbarProps {
  sort: SourceSort;
  onSort: (sort: SourceSort) => void;
  allSelected: boolean;
  /** A change of the selection is on its way. */
  busy: boolean;
  onSelectAll: (selected: boolean) => void;
}

/** Above the list: how it is sorted, and one box to use all sources for answers (or none). */
export function SourcesToolbar({
  sort,
  onSort,
  allSelected,
  busy,
  onSelectAll,
}: SourcesToolbarProps) {
  return (
    <div className="flex h-10 items-center justify-between gap-3 py-1 pr-2 pl-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8"
            aria-label="Quellen sortieren"
            tooltip="Quellen sortieren"
          >
            <ArrowDownWideNarrow />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={sort}
            onValueChange={(value) => onSort(toSourceSort(value) ?? SOURCE_SORT.ADDED)}
          >
            {SORT_CHOICES.map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="flex items-center gap-3 text-[0.875rem] leading-6">
        Alle auswählen
        <Checkbox
          checked={allSelected}
          disabled={busy}
          onCheckedChange={(checked) => onSelectAll(checked === true)}
          aria-label="Alle Quellen auswählen"
        />
      </label>
    </div>
  );
}
