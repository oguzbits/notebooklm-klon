import { Navigate, Outlet } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { ErrorNotice, ListSkeleton } from '@/components/query-boundary';
import { useSession } from '@/hooks/use-session';
import { ROUTES } from '@/lib/routes';

/** Everything behind the sign-in: shows the header, sends signed-out visitors to the sign-in. */
export function ProtectedLayout() {
  const session = useSession();

  if (session.isPending) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ListSkeleton />
      </div>
    );
  }
  if (session.isError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorNotice
          error={session.error}
          onRetry={() => void session.refetch()}
          retrying={session.isFetching}
        />
      </div>
    );
  }
  if (session.data === null) return <Navigate to={ROUTES.SIGN_IN} replace />;

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader email={session.data.email} />
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
