import type { Notebook } from '@nlm/shared';
import { Copy, EllipsisVertical, Paintbrush, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ChatSettingsDialog } from '@/components/chat/chat-settings-dialog';
import { ClearChatDialog, CopyNotebookDialog } from '@/components/notebook/notebook-dialogs';
import { CreateNotebookDialog } from '@/components/notebooks/create-notebook-dialog';
import { DeleteNotebookDialog } from '@/components/notebooks/delete-notebook-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROUTES } from '@/lib/routes';

const DIALOG = {
  CHAT: 'CHAT_SETTINGS',
  COPY: 'COPY',
  CLEAR: 'CLEAR',
  DELETE: 'DELETE',
} as const;
type Dialog = (typeof DIALOG)[keyof typeof DIALOG];

/** The menu behind the three dots: settings, customizing, copying, and the two ways to delete. */
function NotebookMenu({
  onPick,
  onCustomize,
}: {
  onPick: (dialog: Dialog) => void;
  onCustomize: () => void;
}) {
  return (
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
        <DropdownMenuItem onSelect={() => onPick(DIALOG.CHAT)}>
          <SlidersHorizontal aria-hidden />
          Chat konfigurieren
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCustomize}>
          <Paintbrush aria-hidden />
          Notizbuch anpassen
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick(DIALOG.COPY)}>
          <Copy aria-hidden />
          Notizbuch kopieren
        </DropdownMenuItem>
        <DropdownMenuItem className="h-auto py-2" onSelect={() => onPick(DIALOG.CLEAR)}>
          <Trash2 aria-hidden />
          <span className="flex flex-col">
            Chatverlauf löschen
            <span className="text-small text-muted-foreground">
              Der Chatverlauf ist nur für dich sichtbar.
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onPick(DIALOG.DELETE)}>
          <Trash2 aria-hidden />
          Notizbuch löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The questions the menu can lead to; each knows its own action and closes when it is done. */
function NotebookDialogs({
  notebook,
  dialog,
  onClose,
}: {
  notebook: Notebook;
  dialog: Dialog | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <>
      <ChatSettingsDialog
        notebookId={notebook.id}
        open={dialog === DIALOG.CHAT}
        onOpenChange={(open) => !open && onClose()}
      />
      <CopyNotebookDialog notebook={notebook} open={dialog === DIALOG.COPY} onClose={onClose} />
      <ClearChatDialog notebook={notebook} open={dialog === DIALOG.CLEAR} onClose={onClose} />
      <DeleteNotebookDialog
        notebook={dialog === DIALOG.DELETE ? notebook : null}
        onClose={onClose}
        onDeleted={() => navigate(ROUTES.HOME)}
      />
    </>
  );
}

interface NotebookActionsProps {
  notebook: Notebook;
  onCustomize: () => void;
}

/** What the header offers for one notebook: make a new one, and the menu with its settings. */
export function NotebookActions({ notebook, onCustomize }: NotebookActionsProps) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog | null>(null);

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
      <NotebookMenu onPick={setDialog} onCustomize={onCustomize} />
      <NotebookDialogs notebook={notebook} dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
