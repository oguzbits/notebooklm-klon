import { Link } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { tr } from '@/lib/i18n';
import { ROUTES } from '@/lib/routes';

/** An address the app does not know, for example a mistyped link: say so and lead back home. */
export function PageNotFound() {
  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 p-6">
        <h1 className="text-xl font-medium">{tr('Seite nicht gefunden', 'Page not found')}</h1>
        <p className="text-muted-foreground">
          {tr('Diese Adresse gibt es nicht.', 'This address does not exist.')}
        </p>
        <Button asChild variant="outline">
          <Link to={ROUTES.HOME}>{tr('Zu deinen Notebooks', 'To your notebooks')}</Link>
        </Button>
      </div>
    </>
  );
}
