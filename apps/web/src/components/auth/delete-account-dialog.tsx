import { type FormEvent, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteAccount } from '@/hooks/use-session';
import { AuthError } from '@/lib/auth';
import { AUTH_MESSAGE, describeError } from '@/lib/messages';

/** Asks for the password once more, then removes the account with all notebooks and files. */
export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">{open && <DeleteForm />}</DialogContent>
    </Dialog>
  );
}

function DeleteForm() {
  const [password, setPassword] = useState('');
  const remove = useDeleteAccount();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password === '' || remove.isPending) return;
    remove.mutate(password);
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Konto löschen</DialogTitle>
        <DialogDescription>
          Dein Konto wird mit allen Notebooks, Quellen, Notizen und Dateien endgültig gelöscht. Das
          lässt sich nicht rückgängig machen.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="delete-account-password">Passwort</Label>
        <Input
          id="delete-account-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {remove.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {remove.error instanceof AuthError
              ? AUTH_MESSAGE[remove.error.failure]
              : describeError(remove.error)}
          </AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={password === '' || remove.isPending}>
          Konto endgültig löschen
        </Button>
      </DialogFooter>
    </form>
  );
}
