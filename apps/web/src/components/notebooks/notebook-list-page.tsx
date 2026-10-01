import type { Notebook } from '@nlm/shared';
import { NotebookPen, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { CreateNotebookDialog } from '@/components/notebooks/create-notebook-dialog';
import { DeleteNotebookDialog } from '@/components/notebooks/delete-notebook-dialog';
import { NotebookCardMenu } from '@/components/notebooks/notebook-card-menu';
import { NotebookSearch } from '@/components/notebooks/notebook-search';
import { QueryBoundary } from '@/components/query-boundary';
import { NotebookCardsSkeleton } from '@/components/skeletons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNotebooks } from '@/hooks/use-notebooks';
import { formatDay } from '@/lib/day';
import { describeError } from '@/lib/messages';
import { notebookEmoji } from '@/lib/notebook-emoji';
import { IMITATION_NOTICE } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';
import { sourcesLabel } from '@/lib/sources-label';

/** What the page says while the account has no notebook. */
function NoNotebooks() {
  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-panel bg-secondary p-10 text-center">
      <NotebookPen className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-xl font-title">Noch kein Notizbuch</p>
      <p className="text-ui text-muted-foreground">Lege dein erstes Notizbuch an.</p>
    </div>
  );
}

/** What the page says when the search matches no notebook. */
function NoMatch({ search }: { search: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-2 py-16 text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-xl font-title">Kein Notizbuch gefunden</p>
      <p className="text-ui text-muted-foreground">Zu „{search}“ gibt es kein Notizbuch.</p>
    </div>
  );
}

/** One notebook as a card that opens it, with the menu in its corner. */
function NotebookCard({
  notebook,
  onDelete,
  onError,
}: {
  notebook: Notebook;
  onDelete: () => void;
  onError: (error: unknown) => void;
}) {
  return (
    <li className="group/card relative">
      <Link
        to={ROUTES.notebook(notebook.id)}
        className="veil flex h-[185px] flex-col justify-between rounded-bubble bg-secondary p-8"
      >
        <span className="text-4xl leading-9" aria-hidden>
          {notebook.emoji ?? notebookEmoji(notebook.id)}
        </span>
        <span>
          <span className="line-clamp-2 block text-xl leading-6 font-title">{notebook.title}</span>
          <span className="mt-1 block text-ui text-muted-foreground">
            {formatDay(notebook.createdAt)} · {sourcesLabel(notebook.sourceCount)}
          </span>
        </span>
      </Link>
      <NotebookCardMenu notebook={notebook} onDelete={onDelete} onError={onError} />
    </li>
  );
}

/** The signed-in user's notebooks: create, open, delete. */
export function NotebookListPage() {
  const notebooks = useNotebooks();
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);
  const [search, setSearch] = useState('');
  // What went wrong with a pin; deleting reports in its own dialog.
  const [actionError, setActionError] = useState<unknown>(null);
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
            empty={<NoNotebooks />}
          >
            {(all) => {
              const list = all.filter((notebook) =>
                notebook.title.toLocaleLowerCase('de-DE').includes(needle)
              );
              if (list.length === 0) return <NoMatch search={search.trim()} />;
              return (
                <ul className="mt-4 grid gap-2 sm:[grid-template-columns:repeat(auto-fill,272px)]">
                  {list.map((notebook) => (
                    <NotebookCard
                      key={notebook.id}
                      notebook={notebook}
                      onDelete={() => setToDelete({ id: notebook.id, title: notebook.title })}
                      onError={setActionError}
                    />
                  ))}
                </ul>
              );
            }}
          </QueryBoundary>
          {actionError !== null && (
            <Alert variant="destructive">
              <AlertDescription>{describeError(actionError)}</AlertDescription>
            </Alert>
          )}
          <p className="mt-8 text-center text-small text-muted-foreground">{IMITATION_NOTICE}</p>
        </div>
      </div>
      <DeleteNotebookDialog notebook={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}
