import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * One of the three columns. The sources and the Studio are surfaces with 32px corners, 8px of
 * padding inside a 1px invisible border and 12px of space below; the chat (`bare`) sits directly on
 * the page and reaches the window's lower edge. Below the wide layout a panel has no surface and no
 * title, because the switch above it names it. On wide screens a side column can fold into a rail
 * without a surface, like the panels of NotebookLM.
 */
export function Panel({
  title,
  side,
  bare = false,
  titleHidden = false,
  collapsed = false,
  onToggle,
  action,
  className,
  children,
}: {
  title: string;
  /** Which edge the panel sits on; decides the icon of the collapse button. */
  side?: 'left' | 'right';
  /** No surface of its own: the page shows through. */
  bare?: boolean;
  /** The content names itself (a breadcrumb), so the title is kept for screen readers only. */
  titleHidden?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  /** Replaces the collapse button in the header (the reader puts its close button there). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const left = side === 'left';
  const Close = left ? PanelLeftClose : PanelRightClose;
  const Open = left ? PanelLeftOpen : PanelRightOpen;

  if (collapsed) {
    return (
      <section
        aria-label={title}
        className={cn(
          'flex flex-col items-center border border-transparent p-2 max-wide:hidden',
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${title} einblenden`}
          tooltip={`${title} einblenden`}
          onClick={onToggle}
        >
          <Open />
        </Button>
      </section>
    );
  }

  return (
    <section
      aria-label={title}
      className={cn(
        'flex min-h-0 min-w-0 flex-col',
        !bare &&
          'wide:mb-3 wide:rounded-panel wide:border wide:border-transparent wide:bg-card wide:p-2',
        className
      )}
    >
      <header
        className={cn(
          'flex h-9 shrink-0 items-center justify-between pr-0.5 pl-3 max-wide:hidden',
          bare && 'sr-only'
        )}
      >
        <h2 className={cn('text-ui', titleHidden && 'sr-only')}>{title}</h2>
        {action ??
          (onToggle && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${title} ausblenden`}
              tooltip={`${title} ausblenden`}
              onClick={onToggle}
            >
              <Close />
            </Button>
          ))}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
