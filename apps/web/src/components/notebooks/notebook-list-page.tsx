import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

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
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateNotebook, useDeleteNotebook, useNotebooks } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';
import { ROUTES } from '@/lib/routes';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

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
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-6 overflow-y-auto p-6">
      <div>
        <h1 className="text-2xl font-semibold">Deine Notizbücher</h1>
        <p className="text-sm text-muted-foreground">
          Ein Notizbuch sammelt Quellen zu einem Thema. Fragen werden nur aus diesen Quellen
          beantwortet.
        </p>
      </div>

      <CreateNotebookForm />

      <QueryBoundary
        query={notebooks}
        isEmpty={(list) => list.length === 0}
        empty={
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
            <NotebookPen className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Noch kein Notizbuch</p>
            <p className="text-sm text-muted-foreground">Lege oben dein erstes Notizbuch an.</p>
          </div>
        }
      >
        {(list) => (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((notebook) => (
              <li key={notebook.id}>
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-start justify-between gap-2">
                    <Link to={ROUTES.notebook(notebook.id)} className="min-w-0 flex-1">
                      <CardTitle className="truncate">{notebook.title}</CardTitle>
                      <CardDescription>
                        Angelegt am {dateFormat.format(new Date(notebook.createdAt))}
                      </CardDescription>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Notizbuch „${notebook.title}“ löschen`}
                      onClick={() => setToDelete({ id: notebook.id, title: notebook.title })}
                    >
                      <Trash2 />
                    </Button>
                  </CardHeader>
                </Card>
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
    </div>
  );
}
