import { LoaderCircle, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeError } from '@/lib/messages';

/** A shimmering line of the list for something that is being made, with the spinner in front. */
export function PendingRow({ children }: { children: ReactNode }) {
  return (
    <Skeleton
      role="status"
      className="flex h-16 items-center gap-2 rounded-2xl p-3 [--shimmer-base:var(--source-guide)] [--shimmer-edge:color-mix(in_srgb,var(--source-guide),var(--card)_60%)]"
    >
      <span className="flex size-8 shrink-0 items-center justify-center">
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      </span>
      {children}
    </Skeleton>
  );
}

/** The message of a failed action; with `onRetry` it offers to do the same again. */
export function RetryAlert({
  error,
  onRetry,
  disabled,
}: {
  error: unknown;
  onRetry?: () => void;
  disabled?: boolean;
}) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-2">
        <p>{describeError(error)}</p>
        {onRetry && (
          <Button size="sm" variant="outline" disabled={disabled} onClick={onRetry}>
            <RotateCw />
            Erneut versuchen
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
