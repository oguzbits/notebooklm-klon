import { GUEST_LIMITS } from '@nlm/shared';
import { LogOut, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { DeleteAccountDialog } from '@/components/auth/delete-account-dialog';
import { Logo } from '@/components/brand/logo';
import { SettingsMenu } from '@/components/layout/settings-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession, useSignOut } from '@/hooks/use-session';
import { tr } from '@/lib/i18n';
import { describeError } from '@/lib/messages';
import { ROUTES } from '@/lib/routes';

const GUEST_SIGN_OUT_WARNING = tr(
  'Ein Gast-Zugang hat kein Passwort. Nach dem Abmelden kommst du nicht mehr an deine Notebooks und Quellen heran; beim nächsten Mal startest du mit einem neuen Beispiel.',
  'A guest account has no password. After signing out you can no longer reach your notebooks and sources; next time you start with a new example.'
);

/** The bar on top of every page: the mark, an optional title and actions, and the account menu. */
export function AppHeader({ title, actions }: { title?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 pr-3 pl-4 sm:pr-4 sm:pl-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          to={ROUTES.HOME}
          aria-label={tr('Zu deinen Notebooks', 'To your notebooks')}
          className="flex shrink-0 items-center gap-2 rounded-full"
        >
          <Logo />
          {!title && (
            <span className="text-[23px] leading-7 font-[475] tracking-[-0.027em]">NotebookLM</span>
          )}
        </Link>
        {title}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <SettingsMenu />
        <AccountMenu />
      </div>
    </header>
  );
}

function AccountMenu() {
  const session = useSession();
  const signOut = useSignOut();
  const [deleting, setDeleting] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const isGuest = session.data?.isAnonymous === true;
  // A guest has no email address of their own, only a placeholder.
  const email = isGuest ? '' : (session.data?.email ?? '');

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={tr('Konto', 'Account')}
          className="veil inline-flex size-10 items-center justify-center rounded-full bg-secondary text-base font-title text-foreground"
        >
          {isGuest ? 'G' : email.charAt(0).toUpperCase() || '?'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isGuest ? (
            <DropdownMenuLabel>
              <span className="block">{tr('Gast-Zugang', 'Guest account')}</span>
              <span className="block font-normal text-muted-foreground">
                {tr(
                  `Deine Daten werden nach ${GUEST_LIMITS.LIFETIME_DAYS} Tagen gelöscht.`,
                  `Your data is deleted after ${GUEST_LIMITS.LIFETIME_DAYS} days.`
                )}
              </span>
            </DropdownMenuLabel>
          ) : (
            <DropdownMenuLabel>{email}</DropdownMenuLabel>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={signOut.isPending}
            onSelect={() => (isGuest ? setConfirmingSignOut(true) : signOut.mutate())}
          >
            <LogOut aria-hidden />
            {tr('Abmelden', 'Sign out')}
          </DropdownMenuItem>
          {!isGuest && (
            <DropdownMenuItem onSelect={() => setDeleting(true)}>
              <Trash2 aria-hidden />
              {tr('Konto löschen', 'Delete account')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAccountDialog open={deleting} onOpenChange={setDeleting} />
      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title={tr('Als Gast abmelden?', 'Sign out as a guest?')}
        description={signOut.isError ? describeError(signOut.error) : GUEST_SIGN_OUT_WARNING}
        confirmLabel={tr('Abmelden', 'Sign out')}
        pending={signOut.isPending}
        onConfirm={() => signOut.mutate()}
      />
    </>
  );
}
