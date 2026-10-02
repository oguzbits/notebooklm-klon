import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';

import { AuthPage } from '@/components/auth/auth-page';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { LegacyNotebookRedirect } from '@/components/notebook/legacy-notebook-redirect';
import { NotebookListPage } from '@/components/notebooks/notebook-list-page';
import { PageBlank } from '@/components/skeletons';
import { ROUTES } from '@/lib/routes';

// The notebook page holds the chat, the reader and the studio, which the sign-in and the list do not
// need, so it is fetched when the first notebook opens.
const NotebookPage = lazy(async () => ({
  default: (await import('@/components/notebook/notebook-page')).NotebookPage,
}));

export function App() {
  return (
    <Routes>
      <Route path={ROUTES.SIGN_IN} element={<AuthPage />} />
      <Route path={ROUTES.LEGACY_NOTEBOOK_PATTERN} element={<LegacyNotebookRedirect />} />
      <Route element={<ProtectedLayout />}>
        <Route path={ROUTES.HOME} element={<NotebookListPage />} />
        <Route
          path={ROUTES.NOTEBOOK_PATTERN}
          element={
            <Suspense fallback={<PageBlank />}>
              <NotebookPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
