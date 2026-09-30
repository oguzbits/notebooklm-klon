import { BookOpenText, LogOut } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { useSignOut } from '@/hooks/use-session';
import { ROUTES } from '@/lib/routes';

export function AppHeader({ email }: { email: string }) {
  const signOut = useSignOut();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
      <Link to={ROUTES.HOME} className="flex items-center gap-2 font-semibold">
        <BookOpenText className="size-5 text-primary" aria-hidden />
        Notizbücher
      </Link>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut />
          Abmelden
        </Button>
      </div>
    </header>
  );
}
