import { Navigate, useLocation, useParams } from 'react-router';

import { ROUTES } from '@/lib/routes';

/** The notebook used to live at /notizbuecher/…; a saved link still arrives at the new address. */
export function LegacyNotebookRedirect() {
  const { notebookId = '' } = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`${ROUTES.notebook(notebookId)}${search}${hash}`} replace />;
}
