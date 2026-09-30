import { cn } from '@/lib/utils';

/**
 * The mark of the app: three nested arches in the accent color, fading outward, like the rainbow
 * arch of NotebookLM. Drawn for this project in the colors of the theme.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      role="img"
      aria-label="NotebookLM"
      fill="none"
      strokeWidth="3.4"
      strokeLinecap="round"
      className={cn('size-9 shrink-0 stroke-link', className)}
    >
      <path d="M4.5 27V21a13.5 13.5 0 0 1 27 0v6" strokeOpacity="0.45" />
      <path d="M10.5 27V21a7.5 7.5 0 0 1 15 0v6" strokeOpacity="0.75" />
      <path d="M16.5 27V21a1.5 1.5 0 0 1 3 0v6" />
    </svg>
  );
}
