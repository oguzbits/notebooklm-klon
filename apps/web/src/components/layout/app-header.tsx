import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Logo } from '@/components/brand/logo';
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
  const email = session.data?.email ?? '';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to={ROUTES.HOME}
          aria-label="Zu deinen Notizbüchern"
          className="flex shrink-0 items-center gap-2 rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Logo />
          {!title && <span className="text-xl font-medium">NotebookLM</span>}
        </Link>
        {title}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Konto"
            className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-base font-medium text-accent-foreground hover:bg-primary hover:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {email.charAt(0).toUpperCase() || '?'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{email}</DropdownMenuLabel>
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
