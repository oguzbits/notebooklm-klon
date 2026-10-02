import { Navigate, Outlet } from 'react-router';

import { ErrorNotice } from '@/components/query-boundary';
import { PageBlank } from '@/components/skeletons';
import { useSession } from '@/hooks/use-session';
import { ROUTES } from '@/lib/routes';

/** Everything behind the sign-in: sends signed-out visitors to the sign-in. Pages draw their own header. */
export function ProtectedLayout() {
  const session = useSession();

  if (session.isPending) {
    return <PageBlank />;
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
      <Outlet />
    </div>
  );
}
