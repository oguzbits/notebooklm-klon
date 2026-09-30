import { cn } from '@/lib/utils';

/**
 * The mark of the app: an open notebook with a spark. Drawn for this project in the colors of the
 * theme; it stands in for NotebookLM's own logo, which can replace this file.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="NotebookLM"
      className={cn('size-8 shrink-0', className)}
    >
      <rect x="3" y="4" width="22" height="24" rx="6" className="fill-primary" />
      <rect x="7.5" y="9" width="9" height="2.4" rx="1.2" className="fill-primary-foreground" />
      <rect x="7.5" y="14" width="13" height="2.4" rx="1.2" className="fill-primary-foreground" />
      <rect x="7.5" y="19" width="7" height="2.4" rx="1.2" className="fill-primary-foreground" />
      <path
        d="M25 2.5c.4 2.6 1.9 4.1 4.5 4.5-2.6.4-4.1 1.9-4.5 4.5-.4-2.6-1.9-4.1-4.5-4.5 2.6-.4 4.1-1.9 4.5-4.5Z"
        className="fill-primary"
      />
    </svg>
  );
}
