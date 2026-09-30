import type { Notebook } from '@nlm/shared';
import { EllipsisVertical, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ChatSettingsDialog } from '@/components/chat/chat-settings-dialog';
import { CreateNotebookDialog } from '@/components/notebooks/create-notebook-dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useClearChat } from '@/hooks/use-chat';
import { useDeleteNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';
import { ROUTES } from '@/lib/routes';

const DIALOG = { CHAT: 'CHAT', CLEAR: 'CLEAR', DELETE: 'DELETE' } as const;
type Dialog = (typeof DIALOG)[keyof typeof DIALOG];

/** What the header offers for one notebook: make a new one, and the menu with its settings. */
export function NotebookActions({ notebook }: { notebook: Notebook }) {
  const navigate = useNavigate();
  const clear = useClearChat(notebook.id);
  const remove = useDeleteNotebook();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <>
      <CreateNotebookDialog
        trigger={
          <Button variant="ghost" className="pr-4 pl-3">
            <Plus />
            <span className="max-wide:sr-only">Notizbuch erstellen</span>
          </Button>
        }
        onCreated={(created) => navigate(ROUTES.notebook(created.id))}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-9"
            aria-label="Notizbuch-Konfiguration"
            tooltip="Weitere Optionen"
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-70">
          <DropdownMenuItem onSelect={() => setDialog(DIALOG.CHAT)}>
            <SlidersHorizontal aria-hidden />
            Chat konfigurieren
          </DropdownMenuItem>
          <DropdownMenuItem className="h-auto py-2" onSelect={() => setDialog(DIALOG.CLEAR)}>
            <Trash2 aria-hidden />
            <span className="flex flex-col">
              Chatverlauf löschen
              <span className="text-small text-muted-foreground">
                Der Chatverlauf ist nur für dich sichtbar.
              </span>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog(DIALOG.DELETE)}>
            <Trash2 aria-hidden />
            Notizbuch löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChatSettingsDialog
        notebookId={notebook.id}
        open={dialog === DIALOG.CHAT}
        onOpenChange={close}
      />
      <ConfirmDialog
        open={dialog === DIALOG.CLEAR}
        onOpenChange={close}
        title="Chatverlauf löschen?"
        description={
          clear.isError
            ? describeError(clear.error)
            : 'Alle Fragen und Antworten dieses Notizbuchs werden gelöscht. Quellen und Notizen bleiben. Das lässt sich nicht rückgängig machen.'
        }
        pending={clear.isPending}
        onConfirm={() => clear.mutate(undefined, { onSuccess: () => setDialog(null) })}
      />
      <ConfirmDialog
        open={dialog === DIALOG.DELETE}
        onOpenChange={close}
        title="Notizbuch löschen?"
        description={
          remove.isError ? (
            describeError(remove.error)
          ) : (
            <>
              „{notebook.title}“ wird mit allen Quellen und dem Verlauf der Fragen gelöscht. Das
              lässt sich nicht rückgängig machen.
            </>
          )
        }
        pending={remove.isPending}
        onConfirm={() => remove.mutate(notebook.id, { onSuccess: () => navigate(ROUTES.HOME) })}
      />
    </>
  );
}
