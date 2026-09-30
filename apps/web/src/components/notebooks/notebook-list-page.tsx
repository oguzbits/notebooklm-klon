import { BookOpenText, EllipsisVertical, NotebookPen, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { CreateNotebookDialog } from '@/components/notebooks/create-notebook-dialog';
import { QueryBoundary } from '@/components/query-boundary';
import { NotebookCardsSkeleton } from '@/components/skeletons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteNotebook, useNotebooks } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';
import { IMITATION_NOTICE } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

/** The signed-in user's notebooks: create, open, delete. */
export function NotebookListPage() {
  const notebooks = useNotebooks();
  const remove = useDeleteNotebook();
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <AppHeader />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 px-6 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <h1 className="text-2xl leading-8">Deine Notizbücher</h1>
            <CreateNotebookDialog
              trigger={
                <Button variant="prominent" className="pr-3 pl-2">
                  <Plus />
                  Neues Notizbuch
                </Button>
              }
            />
          </div>
          <p className="text-ui text-muted-foreground">
            Ein Notizbuch sammelt Quellen zu einem Thema. Fragen werden nur aus diesen Quellen
            beantwortet.
          </p>

          <QueryBoundary
            query={notebooks}
            loading={<NotebookCardsSkeleton />}
            isEmpty={(list) => list.length === 0}
            empty={
              <div className="mt-4 flex flex-col items-center gap-2 rounded-panel bg-secondary p-10 text-center">
                <NotebookPen className="size-10 text-muted-foreground" aria-hidden />
                <p className="text-xl font-title">Noch kein Notizbuch</p>
                <p className="text-ui text-muted-foreground">Lege dein erstes Notizbuch an.</p>
              </div>
            }
          >
            {(list) => (
              <ul className="mt-4 grid gap-2 sm:[grid-template-columns:repeat(auto-fill,272px)]">
                {list.map((notebook) => (
                  <li key={notebook.id} className="group/card relative">
                    <Link
                      to={ROUTES.notebook(notebook.id)}
                      className="veil flex h-[185px] flex-col justify-between rounded-bubble bg-secondary p-8"
                    >
                      <BookOpenText className="size-9 text-muted-foreground" aria-hidden />
                      <span>
                        <span className="line-clamp-2 block text-xl leading-6 font-title">
                          {notebook.title}
                        </span>
                        <span className="mt-1 block text-ui text-muted-foreground">
                          {dateFormat.format(new Date(notebook.createdAt))}
                        </span>
                      </span>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="absolute top-6 right-6"
                          aria-label={`Weitere Aktionen für Notizbuch „${notebook.title}“`}
                          tooltip="Mehr"
                        >
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => setToDelete({ id: notebook.id, title: notebook.title })}
                        >
                          <Trash2 aria-hidden />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </QueryBoundary>

          {remove.isError && (
            <Alert variant="destructive">
              <AlertDescription>{describeError(remove.error)}</AlertDescription>
            </Alert>
          )}
          <p className="mt-8 text-center text-small text-muted-foreground">{IMITATION_NOTICE}</p>
        </div>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Notizbuch löschen?"
        description={
          <>
            „{toDelete?.title}“ wird mit allen Quellen und dem Verlauf der Fragen gelöscht. Das
            lässt sich nicht rückgängig machen.
          </>
        }
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  );
}
