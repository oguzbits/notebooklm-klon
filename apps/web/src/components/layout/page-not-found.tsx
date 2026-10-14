import { Link } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/lib/routes';

/** An address the app does not know, for example a mistyped link: say so and lead back home. */
export function PageNotFound() {
  return (
    <>
      <AppHeader />
      <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 p-6">
        <h1 className="text-xl font-medium">Seite nicht gefunden</h1>
        <p className="text-muted-foreground">Diese Adresse gibt es nicht.</p>
        <Button asChild variant="outline">
          <Link to={ROUTES.HOME}>Zu deinen Notebooks</Link>
        </Button>
      </div>
    </>
  );
}
