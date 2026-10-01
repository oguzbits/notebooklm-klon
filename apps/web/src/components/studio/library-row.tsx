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
  unread = false,
  deleting,
  onOpen,
  onDelete,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  /** Nobody has opened it yet: a blue dot stands where the menu is until the pointer comes. */
  unread?: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={cn('group/row veil flex items-center rounded-xl', deleting && 'opacity-50')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            // The two lines would run together as one word for a screen reader.
            aria-label={`${unread ? 'Ungelesen: ' : ''}${title}, ${subtitle}`}
            onClick={onOpen}
            className="flex h-[60px] min-w-0 flex-1 items-center gap-2 rounded-xl p-2 text-left"
          >
            <span className="flex size-8 shrink-0 items-center justify-center">
              <Icon className={cn('size-6', iconClassName)} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-small">
              <span className="block truncate">{title}</span>
              <span className="block truncate text-[0.75rem] leading-4 text-muted-foreground">
                {subtitle}
              </span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{title}</TooltipContent>
      </Tooltip>
      {unread && (
        <span
          aria-hidden
          className="mr-3 size-2 shrink-0 rounded-full bg-dot group-focus-within/row:hidden group-hover/row:hidden"
        />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'mr-1',
              unread &&
                'hidden group-focus-within/row:inline-flex group-hover/row:inline-flex data-[state=open]:inline-flex'
            )}
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
