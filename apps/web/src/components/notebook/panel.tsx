import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Both faces of a panel fade into each other; the one that is not shown is out of reach as well. */
const FACE = 'transition-[opacity,visibility] duration-150 ease-in-out';
const RAIL_GONE = 'invisible opacity-0';
/** Below the wide layout nothing folds, so the content is always there. */
const CONTENT_GONE = 'wide:invisible wide:opacity-0';

interface PanelProps {
  title: string;
  /** Which edge the panel sits on; decides the icon of the collapse button. */
  side?: 'left' | 'right';
  /** No surface of its own: the page shows through. */
  bare?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  /** Written by the content instead of the title (a path back, "Studio › Notiz"). */
  header?: ReactNode;
  /** Replaces the collapse button in the header (the reader puts its close button there). */
  action?: ReactNode;
  /** What the folded panel shows under its open button. */
  rail?: ReactNode;
  className?: string;
  children: ReactNode;
}

interface PanelHeaderProps {
  title: string;
  left: boolean;
  bare: boolean;
  header: ReactNode;
  action: ReactNode;
  onToggle?: () => void;
}

/** The line on top of a panel: its name or the path the content writes, and the button that folds it. */
function PanelHeader({ title, left, bare, header, action, onToggle }: PanelHeaderProps) {
  const Close = left ? PanelLeftClose : PanelRightClose;
  const fold = onToggle && (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`${title} ausblenden`}
      tooltip={`${title} ausblenden`}
      onClick={onToggle}
    >
      <Close />
    </Button>
  );
  return (
    <header
      className={cn(
        'flex h-9 shrink-0 items-center justify-between pr-0.5 pl-3',
        // The switch above the columns names a panel below the wide layout, but a path back and
        // a button the content brings (the reader's close button) are not a name: they stay.
        !header && !action && 'max-wide:hidden',
        bare && 'sr-only'
      )}
    >
      {header ?? <h2 className="text-ui">{title}</h2>}
      {action ?? fold}
    </header>
  );
}

interface PanelRailProps {
  title: string;
  left: boolean;
  collapsed: boolean;
  onToggle: () => void;
  rail: ReactNode;
}

/** What a folded panel shows: the button that opens it again and the symbols the content gives. */
function PanelRail({ title, left, collapsed, onToggle, rail }: PanelRailProps) {
  const Open = left ? PanelLeftOpen : PanelRightOpen;
  return (
    <div
      inert={!collapsed}
      aria-hidden={!collapsed}
      className={cn(
        'absolute inset-0 flex flex-col items-center gap-2 p-2 max-wide:hidden',
        FACE,
        !collapsed && RAIL_GONE
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
      {rail}
    </div>
  );
}

/**
 * One of the three columns. The sources and the Studio are surfaces with 32px corners, 8px of
 * padding inside a 1px invisible border and 12px of space below; the chat (`bare`) sits directly on
 * the page and reaches the window's lower edge. Below the wide layout a panel has no surface and no
 * title, because the switch above it names it.
 *
 * On wide screens a side column can fold into a rail without a surface, like the panels of
 * NotebookLM. Both the content and the rail stay in the page and fade into each other while the
 * column changes its width (set by the page), so folding never jumps and nothing the content holds
 * (an open note, a half written entry) is lost.
 */
export function Panel({
  title,
  side,
  bare = false,
  collapsed = false,
  onToggle,
  header,
  action,
  rail,
  className,
  children,
}: PanelProps) {
  const left = side === 'left';

  return (
    <section
      aria-label={title}
      className={cn(
        'relative flex min-h-0 min-w-0 flex-col overflow-hidden',
        !bare &&
          'wide:mb-3 wide:rounded-panel wide:border wide:border-transparent wide:p-2 wide:transition-colors wide:duration-200 wide:ease-in-out',
        !bare && !collapsed && 'wide:bg-card',
        className
      )}
    >
      <div
        inert={collapsed}
        aria-hidden={collapsed || undefined}
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          FACE,
          collapsed ? CONTENT_GONE : 'wide:delay-75'
        )}
      >
        <PanelHeader
          title={title}
          left={left}
          bare={bare}
          header={header}
          action={action}
          onToggle={onToggle}
        />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
      {onToggle && (
        <PanelRail
          title={title}
          left={left}
          collapsed={collapsed}
          onToggle={onToggle}
          rail={rail}
        />
      )}
    </section>
  );
}
