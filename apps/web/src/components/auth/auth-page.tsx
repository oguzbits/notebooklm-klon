import { type FormEvent, useState } from 'react';
import { Navigate } from 'react-router';

import { Logo } from '@/components/brand/logo';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthenticate, useSession } from '@/hooks/use-session';
import { AUTH_FAILURE, AuthError } from '@/lib/auth';
import { AUTH_MESSAGE } from '@/lib/messages';
import { IMITATION_NOTICE } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';

const MIN_PASSWORD_LENGTH = 8;

/** Sign in and sign up in one form: the same two fields, only the mode differs. */
export function AuthPage() {
  const [signingUp, setSigningUp] = useState(false);
  const session = useSession();
  const authenticate = useAuthenticate(signingUp ? 'signUp' : 'signIn');

  if (session.data) return <Navigate to={ROUTES.HOME} replace />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    authenticate.mutate({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    });
  };

  const failure = authenticate.error;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Logo />
            <span className="text-xl font-medium">NotebookLM</span>
          </div>
          <CardTitle>
            <h1 className="text-xl">{signingUp ? 'Konto erstellen' : 'Anmelden'}</h1>
          </CardTitle>
          <CardDescription>
            Stelle Fragen an deine eigenen Dokumente und prüfe jede Antwort an der Textstelle.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={signingUp ? 'new-password' : 'current-password'}
                minLength={signingUp ? MIN_PASSWORD_LENGTH : undefined}
                required
              />
              {signingUp && <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>}
            </div>
            {failure && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>
                  {
                    AUTH_MESSAGE[
                      failure instanceof AuthError ? failure.failure : AUTH_FAILURE.UNKNOWN
                    ]
                  }
                </AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={authenticate.isPending}>
              {authenticate.isPending
                ? 'Einen Moment …'
                : signingUp
                  ? 'Konto erstellen'
                  : 'Anmelden'}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => {
                authenticate.reset();
                setSigningUp((value) => !value);
              }}
            >
              {signingUp ? 'Ich habe schon ein Konto' : 'Noch kein Konto? Jetzt registrieren'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="max-w-sm text-center text-xs text-muted-foreground">{IMITATION_NOTICE}</p>
    </div>
  );
}
