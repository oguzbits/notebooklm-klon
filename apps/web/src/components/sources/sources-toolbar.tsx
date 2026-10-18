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
import { tr } from '@/lib/i18n';
import { SOURCE_SORT, type SourceSort, toSourceSort } from '@/lib/sort-sources';

const SORT_CHOICES = [
  [SOURCE_SORT.LATEST, tr('Letzte', 'Latest')],
  [SOURCE_SORT.TITLE, tr('Titel', 'Title')],
  [SOURCE_SORT.TYPE, tr('Typ', 'Type')],
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
            aria-label={tr('Quellen sortieren', 'Sort sources')}
            tooltip={tr('Quellen sortieren', 'Sort sources')}
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
        {tr('Alle auswählen', 'Select all')}
        <Checkbox
          checked={allSelected}
          disabled={busy}
          onCheckedChange={(checked) => onSelectAll(checked === true)}
          aria-label={tr('Alle Quellen auswählen', 'Select all sources')}
        />
      </label>
    </div>
  );
}
