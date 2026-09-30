import { BookOpenText, EllipsisVertical, NotebookPen, Plus, Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateNotebook, useDeleteNotebook, useNotebooks } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';
import { IMITATION_NOTICE } from '@/lib/notice';
import { ROUTES } from '@/lib/routes';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' });

/** The soft blue button of the page and the dialog behind it, where the title is asked. */
function CreateNotebookDialog() {
  const create = useCreateNotebook();
  const [open, setOpen] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (title) {
      create.mutate(title, {
        onSuccess: () => {
          form.reset();
          setOpen(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="prominent" className="pr-3 pl-2">
          <Plus />
          Neues Notizbuch
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Notizbuch</DialogTitle>
          <DialogDescription>
            Ein Notizbuch sammelt Quellen zu einem Thema. Fragen werden nur aus diesen Quellen
            beantwortet.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="notebook-title">Titel des Notizbuchs</Label>
            <Input
              id="notebook-title"
              name="title"
              placeholder="Zum Beispiel: Steuerrecht"
              maxLength={200}
              required
            />
          </div>
          {create.isError && (
            <Alert variant="destructive">
              <AlertDescription>{describeError(create.error)}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="self-end" disabled={create.isPending}>
            {create.isPending ? 'Wird angelegt …' : 'Anlegen'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
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
        <div className="flex flex-col gap-2 px-6 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <h1 className="text-2xl leading-8">Deine Notizbücher</h1>
            <CreateNotebookDialog />
          </div>
          <p className="text-ui text-muted-foreground">
            Ein Notizbuch sammelt Quellen zu einem Thema. Fragen werden nur aus diesen Quellen
            beantwortet.
          </p>

          <QueryBoundary
            query={notebooks}
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
