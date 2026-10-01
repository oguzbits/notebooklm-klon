import type { FormEvent } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AUTH_FAILURE, AuthError } from '@/lib/auth';
import { AUTH_MESSAGE } from '@/lib/messages';

const MIN_PASSWORD_LENGTH = 8;

/** The words and the field settings that differ between signing in and signing up. */
export const MODE = {
  signIn: {
    heading: 'Anmelden',
    submit: 'Anmelden',
    toggle: 'Noch kein Konto? Jetzt registrieren',
    autoComplete: 'current-password',
    minLength: undefined,
  },
  signUp: {
    heading: 'Konto erstellen',
    submit: 'Konto erstellen',
    toggle: 'Ich habe schon ein Konto',
    autoComplete: 'new-password',
    minLength: MIN_PASSWORD_LENGTH,
  },
} as const;
export type AuthMode = keyof typeof MODE;

/** The message for a failed sign-in, sign-up or guest start. */
function FailureAlert({ failure }: { failure: unknown }) {
  const reason = failure instanceof AuthError ? failure.failure : AUTH_FAILURE.UNKNOWN;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{AUTH_MESSAGE[reason]}</AlertDescription>
    </Alert>
  );
}

/** E-mail and password, the button that sends them and the one that switches between the modes. */
export function AuthForm({
  mode,
  pending,
  submitting,
  failure,
  onSubmit,
  onToggle,
}: {
  mode: AuthMode;
  /** Something is under way, signing in or starting the guest: nothing can be sent again. */
  pending: boolean;
  /** The credentials are being sent. */
  submitting: boolean;
  /** What went wrong the last time, if anything. */
  failure: unknown;
  onSubmit: (credentials: { email: string; password: string }) => void;
  onToggle: () => void;
}) {
  const text = MODE[mode];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    });
  };

  return (
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
          autoComplete={text.autoComplete}
          minLength={text.minLength}
          required
        />
        {mode === 'signUp' && (
          <p className="text-xs text-muted-foreground">Mindestens {MIN_PASSWORD_LENGTH} Zeichen.</p>
        )}
      </div>
      {failure ? <FailureAlert failure={failure} /> : null}
      <Button type="submit" disabled={pending}>
        {submitting ? 'Einen Moment …' : text.submit}
      </Button>
      <Button type="button" variant="link" onClick={onToggle}>
        {text.toggle}
      </Button>
    </form>
  );
}
