import { BookOpenText, NotebookPen, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { AppHeader } from '@/components/layout/app-header';
import { QueryBoundary } from '@/components/query-boundary';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateNotebook, useDeleteNotebook, useNotebooks } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';
import { IMITATION_NOTICE } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });
const TONES = ['bg-tone-1', 'bg-tone-2', 'bg-tone-3', 'bg-tone-4'] as const;

/** The same notebook always gets the same color, taken from its ID. */
function toneOf(id: string): string {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return TONES[sum % TONES.length] ?? TONES[0];
}

function CreateNotebookForm() {
  const create = useCreateNotebook();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (title) create.mutate(title, { onSuccess: () => form.reset() });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="notebook-title">Neues Notizbuch</Label>
        <Input
          id="notebook-title"
          name="title"
          placeholder="Zum Beispiel: Steuerrecht"
          maxLength={200}
          required
        />
      </div>
      <Button type="submit" disabled={create.isPending}>
        <Plus />
        {create.isPending ? 'Wird angelegt …' : 'Anlegen'}
      </Button>
      {create.isError && (
        <Alert variant="destructive" className="sm:basis-full">
          <AlertDescription>{describeError(create.error)}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

/** The signed-in user's notebooks: create, open, delete. */
export function NotebookListPage() {
  const notebooks = useNotebooks();
  const remove = useDeleteNotebook();
  const [toDelete, setToDelete] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <AppHeader />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-3xl font-medium">Deine Notizbücher</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ein Notizbuch sammelt Quellen zu einem Thema. Fragen werden nur aus diesen Quellen
              beantwortet.
            </p>
          </div>

          <CreateNotebookForm />

          <QueryBoundary
            query={notebooks}
            isEmpty={(list) => list.length === 0}
            empty={
              <div className="flex flex-col items-center gap-2 rounded-3xl bg-card p-10 text-center">
                <NotebookPen className="size-10 text-primary" aria-hidden />
                <p className="font-medium">Noch kein Notizbuch</p>
                <p className="text-sm text-muted-foreground">Lege oben dein erstes Notizbuch an.</p>
              </div>
            }
          >
            {(list) => (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((notebook) => (
                  <li key={notebook.id} className="relative">
                    <Link
                      to={ROUTES.notebook(notebook.id)}
                      className={`flex h-48 flex-col justify-between rounded-3xl p-5 transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${toneOf(notebook.id)}`}
                    >
                      <BookOpenText className="size-7 text-primary" aria-hidden />
                      <span>
                        <span className="line-clamp-2 block text-xl leading-snug font-medium">
                          {notebook.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Angelegt am {dateFormat.format(new Date(notebook.createdAt))}
                        </span>
                      </span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-3 right-3"
                      aria-label={`Notizbuch „${notebook.title}“ löschen`}
                      onClick={() => setToDelete({ id: notebook.id, title: notebook.title })}
                    >
                      <Trash2 />
                    </Button>
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
          <p className="text-center text-xs text-muted-foreground">{IMITATION_NOTICE}</p>
        </div>
      </div>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Notizbuch löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{toDelete?.title}“ wird mit allen Quellen und dem Verlauf der Fragen gelöscht. Das
              lässt sich nicht rückgängig machen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => toDelete && remove.mutate(toDelete.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
