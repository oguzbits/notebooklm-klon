import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { describeError } from '@/lib/messages';

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
  /** What to show while the first load runs: a placeholder in the shape of the content. */
  loading: ReactNode;
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
  loading,
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
