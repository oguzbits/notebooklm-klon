import { EllipsisVertical, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The frame around one thing of the Studio in full, in place of the list: its title with the menu
 * that deletes it, and the content that scrolls. The path back lives in the header of the column.
 */
export function ViewerFrame({
  title,
  subtitle,
  deleteLabel,
  deleting,
  onDelete,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  deleteLabel: string;
  deleting: boolean;
  onDelete: () => void;
  /** What sits under the content and stays in view (a button for the thing as a whole). */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-2 pt-3 pr-1 pl-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[1.375rem] leading-9">{title}</h3>
          <p className="truncate text-small text-muted-foreground">{subtitle}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Weitere Aktionen"
              tooltip="Mehr"
              disabled={deleting}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={deleting} onSelect={onDelete}>
              <Trash2 aria-hidden />
              {deleteLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-3">{children}</div>
      {footer && <div className="shrink-0 px-3 pb-1">{footer}</div>}
    </div>
  );
}
