import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeError } from '@/lib/messages';

const SKELETON_ROWS = 3;

export function ListSkeleton({ rows = SKELETON_ROWS }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Wird geladen">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ErrorNotice({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>Das hat nicht geklappt</AlertTitle>
      <AlertDescription>
        <p>{describeError(error)}</p>
        <Button className="mt-2" size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
          <RotateCw />
          Erneut versuchen
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  /** What to show while the first load runs. */
  loading?: ReactNode;
  /** When this returns true the empty state is shown instead of the content. */
  isEmpty?: (data: T) => boolean;
  empty: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * The four states of a list that comes from the server: loading, error with retry, empty, and the
 * content itself. The fourth state, a pending change, lives on the buttons that cause it.
 */
export function QueryBoundary<T>({
  query,
  loading = <ListSkeleton />,
  isEmpty,
  empty,
  children,
}: QueryBoundaryProps<T>) {
  if (query.isPending) return loading;
  if (query.isError) {
    return (
      <ErrorNotice
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  return isEmpty?.(query.data) ? empty : children(query.data);
}
