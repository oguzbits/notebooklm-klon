import { Route, Routes } from 'react-router';

import { AuthPage } from '@/components/auth/auth-page';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { NotebookPage } from '@/components/notebook/notebook-page';
import { NotebookListPage } from '@/components/notebooks/notebook-list-page';
import { ROUTES } from '@/lib/routes';

export function App() {
  return (
    <Routes>
      <Route path={ROUTES.SIGN_IN} element={<AuthPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path={ROUTES.HOME} element={<NotebookListPage />} />
        <Route path={ROUTES.NOTEBOOK_PATTERN} element={<NotebookPage />} />
      </Route>
    </Routes>
  );
}
