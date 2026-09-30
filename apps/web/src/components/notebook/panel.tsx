import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * One of the three columns. The sources and the Studio are surfaces with 32px corners; the chat
 * (`bare`) sits directly on the page. Below the wide layout a panel has no surface and no title,
 * because the switch above it names it. On wide screens the side columns can shrink to a narrow
 * rail, like the panels of NotebookLM.
 */
export function Panel({
  title,
  side,
  bare = false,
  titleHidden = false,
  collapsed = false,
  onToggle,
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
          'flex flex-col items-center rounded-panel bg-card py-3 max-wide:hidden',
          className
        )}
      >
        <Button variant="ghost" size="icon" aria-label={`${title} einblenden`} onClick={onToggle}>
          <Open />
        </Button>
        <span className="mt-4 text-ui text-muted-foreground [writing-mode:vertical-rl]">
          {title}
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label={title}
      className={cn(
        'flex min-h-0 flex-col',
        !bare && 'wide:rounded-panel wide:bg-card wide:p-2',
        className
      )}
    >
      <header
        className={cn(
          'flex h-10 shrink-0 items-center justify-between pr-1 pl-3 max-wide:hidden',
          bare && 'sr-only'
        )}
      >
        <h2 className={cn('text-ui', titleHidden && 'sr-only')}>{title}</h2>
        {onToggle && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${title} ausblenden`}
            onClick={onToggle}
          >
            <Close />
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
