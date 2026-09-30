import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * One of the three columns: a white rounded surface with a title row. On wide screens the side
 * columns can shrink to a narrow rail, like the panels of NotebookLM.
 */
export function Panel({
  title,
  side,
  collapsed = false,
  onToggle,
  className,
  children,
}: {
  title: string;
  /** Which edge the panel sits on; decides the icon of the collapse button. */
  side?: 'left' | 'right';
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
          'flex flex-col items-center rounded-3xl bg-card py-3 max-lg:hidden',
          className
        )}
      >
        <Button variant="ghost" size="icon" aria-label={`${title} einblenden`} onClick={onToggle}>
          <Open />
        </Button>
        <span className="mt-4 text-sm font-medium text-muted-foreground [writing-mode:vertical-rl]">
          {title}
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label={title}
      className={cn('flex min-h-0 flex-col rounded-3xl bg-card', className)}
    >
      <header className="flex h-14 shrink-0 items-center justify-between pr-3 pl-5">
        <h2 className="text-base font-medium">{title}</h2>
        {onToggle && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="max-lg:hidden"
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
