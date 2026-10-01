import { useState } from 'react';
import { Navigate } from 'react-router';

import { AuthForm, type AuthMode, MODE } from '@/components/auth/auth-form';
import { GuestStart } from '@/components/auth/guest-start';
import { Logo } from '@/components/brand/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthenticate, useSession, useStartGuest } from '@/hooks/use-session';
import { IMITATION_NOTICE } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';

/** Sign in and sign up in one form: the same two fields, only the mode differs. */
export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signIn');
  const session = useSession();
  const authenticate = useAuthenticate(mode);
  const guest = useStartGuest();

  // A guest lands in the example notebook, everybody else on the list of notebooks.
  if (session.data) {
    return <Navigate to={guest.data ? ROUTES.notebook(guest.data) : ROUTES.HOME} replace />;
  }

  const pending = authenticate.isPending || guest.isPending;
  const switchMode = () => {
    authenticate.reset();
    guest.reset();
    setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Logo />
            <span className="text-xl font-medium">NotebookLM</span>
          </div>
          <CardTitle>
            <h1 className="text-xl">{MODE[mode].heading}</h1>
          </CardTitle>
          <CardDescription>
            Stelle Fragen an deine eigenen Dokumente und prüfe jede Antwort an der Textstelle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm
            mode={mode}
            pending={pending}
            submitting={authenticate.isPending}
            failure={authenticate.error ?? guest.error}
            onSubmit={authenticate.mutate}
            onToggle={switchMode}
          />
          <GuestStart
            pending={pending}
            starting={guest.isPending}
            onStart={() => {
              authenticate.reset();
              guest.mutate();
            }}
          />
        </CardContent>
      </Card>
      <p className="max-w-sm text-center text-xs text-muted-foreground">{IMITATION_NOTICE}</p>
    </div>
  );
}
