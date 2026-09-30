import { EllipsisVertical, NotebookPen, Plus, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { CreateNotebookDialog } from '@/components/notebooks/create-notebook-dialog';
import { NotebookSearch } from '@/components/notebooks/notebook-search';
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
import { notebookEmoji } from '@/lib/notebook-emoji';
import { IMITATION_NOTICE } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const sourcesLabel = (count: number) => `${count} ${count === 1 ? 'Quelle' : 'Quellen'}`;

/** The signed-in user's notebooks: create, open, delete. */
export function NotebookListPage() {
  const notebooks = useNotebooks();
  const remove = useDeleteNotebook();
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const [search, setSearch] = useState('');
  const needle = search.trim().toLocaleLowerCase('de-DE');

  return (
    <>
      <AppHeader actions={<NotebookSearch value={search} onChange={setSearch} />} />
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
            {(all) => {
              const list = all.filter((notebook) =>
                notebook.title.toLocaleLowerCase('de-DE').includes(needle)
              );
              return list.length === 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 py-16 text-center">
                  <SearchX className="size-10 text-muted-foreground" aria-hidden />
                  <p className="text-xl font-title">Kein Notizbuch gefunden</p>
                  <p className="text-ui text-muted-foreground">
                    Zu „{search.trim()}“ gibt es kein Notizbuch.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 grid gap-2 sm:[grid-template-columns:repeat(auto-fill,272px)]">
                  {list.map((notebook) => (
                    <li key={notebook.id} className="group/card relative">
                      <Link
                        to={ROUTES.notebook(notebook.id)}
                        className="veil flex h-[185px] flex-col justify-between rounded-bubble bg-secondary p-8"
                      >
                        <span className="text-4xl leading-9" aria-hidden>
                          {notebookEmoji(notebook.id)}
                        </span>
                        <span>
                          <span className="line-clamp-2 block text-xl leading-6 font-title">
                            {notebook.title}
                          </span>
                          <span className="mt-1 block text-ui text-muted-foreground">
                            {dateFormat.format(new Date(notebook.createdAt))} ·{' '}
                            {sourcesLabel(notebook.sourceCount)}
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
              );
            }}
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
