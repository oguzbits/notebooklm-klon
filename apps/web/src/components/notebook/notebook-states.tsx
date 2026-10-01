import { Link } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { ErrorNotice } from '@/components/query-boundary';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';

/** The notebook could not be loaded: the message with a way to try again. */
export function NotebookLoadFailed({
  error,
  onRetry,
  retrying,
}: {
  error: unknown;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <>
      <AppHeader />
      <div className="mx-auto w-full max-w-xl p-6">
        <ErrorNotice error={error} onRetry={onRetry} retrying={retrying} />
      </div>
    </>
  );
}

/** The address points to a notebook that is not in this account. */
export function NotebookNotFound() {
  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 p-6">
        <h1 className="text-xl font-medium">Notizbuch nicht gefunden</h1>
        <p className="text-muted-foreground">
          Dieses Notizbuch gibt es nicht (mehr) in deinem Konto.
        </p>
        <Button asChild variant="outline">
          <Link to={ROUTES.HOME}>Zu deinen Notizbüchern</Link>
        </Button>
      </div>
    </>
  );
}
