import { EllipsisVertical, type LucideIcon, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * One line of the list of the Studio: what was made or saved, 60px high like in the original. The
 * title opens it, the menu at the end deletes it.
 */
export function LibraryRow({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  deleting,
  onOpen,
  onDelete,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={cn('veil flex items-center rounded-xl', deleting && 'opacity-50')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            className="flex h-[60px] min-w-0 flex-1 items-center gap-2 rounded-xl p-2 text-left"
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              <Icon className={cn('size-6', iconClassName)} aria-hidden />
            </span>
            <span className="min-w-0 text-small">
              <span className="block truncate">{title}</span>
              <span className="block truncate text-[0.75rem] leading-4 text-muted-foreground">
                {subtitle}
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="mr-1"
            aria-label={`Weitere Aktionen für „${title}“`}
            tooltip="Mehr"
            disabled={deleting}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={deleting} onSelect={onDelete}>
            <Trash2 aria-hidden />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
