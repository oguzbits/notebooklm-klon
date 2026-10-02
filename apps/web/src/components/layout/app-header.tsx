import { GUEST_LIMITS } from '@nlm/shared';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Logo } from '@/components/brand/logo';
import { SettingsMenu } from '@/components/layout/settings-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession, useSignOut } from '@/hooks/use-session';
import { ROUTES } from '@/lib/routes';

/** The bar on top of every page: the mark, an optional title and actions, and the account menu. */
export function AppHeader({ title, actions }: { title?: ReactNode; actions?: ReactNode }) {
  const session = useSession();
  const signOut = useSignOut();
  const isGuest = session.data?.isAnonymous === true;
  // A guest has no email address of their own, only a placeholder.
  const email = isGuest ? '' : (session.data?.email ?? '');

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 pr-3 pl-4 sm:pr-4 sm:pl-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          to={ROUTES.HOME}
          aria-label="Zu deinen Notebooks"
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
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Konto"
            className="veil inline-flex size-10 items-center justify-center rounded-full bg-secondary text-base font-title text-foreground"
          >
            {isGuest ? 'G' : email.charAt(0).toUpperCase() || '?'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isGuest ? (
              <DropdownMenuLabel>
                <span className="block">Gast-Zugang</span>
                <span className="block font-normal text-muted-foreground">
                  Deine Daten werden nach {GUEST_LIMITS.LIFETIME_DAYS} Tagen gelöscht.
                </span>
              </DropdownMenuLabel>
            ) : (
              <DropdownMenuLabel>{email}</DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={signOut.isPending} onSelect={() => signOut.mutate()}>
              <LogOut aria-hidden />
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
