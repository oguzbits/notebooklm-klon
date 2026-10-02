import { LoaderCircle } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

/** Each placeholder keeps the size and place of what it stands for, measured on the original. */

const STATUS = { role: 'status', 'aria-label': 'Wird geladen' } as const;

/** The rows of the sources: a symbol, a title and the box to tick. */
export function SourceRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col" {...STATUS}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-9 items-center gap-3 px-2">
          <Skeleton className="size-6 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="size-[18px] shrink-0 rounded-[3px]" />
        </div>
      ))}
    </div>
  );
}

/** How much of the line each bar of a loading answer fills. */
const BAR_WIDTHS = [
  'w-[85%]',
  'w-[95%]',
  'w-full',
  'w-[95%]',
  'w-[98%]',
  'w-[95%]',
  'w-full',
] as const;

const TextBars = () =>
  BAR_WIDTHS.map((width, index) => <Skeleton key={index} className={`h-[46px] ${width}`} />);

/**
 * The size of the cover of a notebook: 265 high like in the original, on a phone, which was not
 * measured, a good deal shorter. It reaches 24 px beyond the text on each side. The cover and its
 * placeholder share it, so nothing moves when the real one arrives.
 */
export const COVER_BOX = '-mx-6 min-h-[200px] rounded-panel sm:min-h-[265px]';

/**
 * The chat while its history loads, laid out like the overview that follows: the place of the cover,
 * then seven bars of text. No spinner (the bars already say it loads).
 */
export function ChatSkeleton() {
  return (
    <div className="-mt-2 flex flex-col" {...STATUS}>
      <Skeleton className={COVER_BOX} />
      <div className="mt-6 flex flex-col gap-2">
        <TextBars />
      </div>
    </div>
  );
}

/** The summary of a notebook while it is made: the same seven bars, under the cover that is already there. */
export function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-2" {...STATUS}>
      <TextBars />
    </div>
  );
}

/** The list of what the Studio made: rows on the soft blue of the source card, a disc and two lines. */
export function OutputRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" {...STATUS}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className="flex h-16 items-center gap-3 rounded-2xl p-3 [--shimmer-base:var(--source-guide)] [--shimmer-edge:color-mix(in_srgb,var(--source-guide),var(--card)_60%)]"
        >
          <span className="size-8 shrink-0 rounded-full bg-card/60" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3 w-[70%] rounded-[4px] bg-card/60" />
            <span className="h-3 w-[42%] rounded-[4px] bg-card/60" />
          </span>
        </Skeleton>
      ))}
    </div>
  );
}

/** The notebooks on the start page: cards as big as the real ones, with the stronger sweep. */
export function NotebookCardsSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <ul className="mt-4 grid gap-2 sm:[grid-template-columns:repeat(auto-fill,272px)]" {...STATUS}>
      {Array.from({ length: cards }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-[185px] rounded-bubble [--shimmer-base:var(--secondary)] [--shimmer-edge:color-mix(in_srgb,var(--foreground)_12%,var(--secondary))]" />
        </li>
      ))}
    </ul>
  );
}

/** The whole page, while it cannot yet know what to show: an empty area, so no spinner sits before the skeletons. */
export function PageBlank() {
  return <div className="h-dvh" {...STATUS} />;
}

/** A dialog that waits for its content: the spinner and the words, like the original ("Wird geladen…"). */
export function DialogSpinner() {
  return (
    <div
      className="flex items-center justify-center gap-3 py-10 text-ui text-muted-foreground"
      {...STATUS}
    >
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      Wird geladen …
    </div>
  );
}

/** A note of the reader while its editor loads: the title, the bar of tools and a few lines of text. */
export function NoteEditorSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col" {...STATUS}>
      <div className="flex h-12 items-center px-3">
        <Skeleton className="h-6 w-2/5" />
      </div>
      <div className="flex h-[66px] items-center gap-3 border-y border-border px-4">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="size-8 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 px-4 pt-4">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[70%]" />
      </div>
    </div>
  );
}
