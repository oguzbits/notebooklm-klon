import type { Notebook } from '@nlm/shared';
import { useNavigate } from 'react-router';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useClearChat } from '@/hooks/use-chat';
import { useCopyNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';
import { ROUTES } from '@/lib/routes';

interface NotebookDialogProps {
  notebook: Notebook;
  open: boolean;
  onClose: () => void;
}

/** Asks before the notebook is copied; the copy opens when it is made. */
export function CopyNotebookDialog({ notebook, open, onClose }: NotebookDialogProps) {
  const navigate = useNavigate();
  const copy = useCopyNotebook();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Notizbuch kopieren?"
      description={
        copy.isError
          ? describeError(copy.error)
          : 'Die Kopie hat dieselben Quellen und Zusammenfassungen. Chatverlauf, Notizen und Ausgaben des Studios bleiben beim Original.'
      }
      confirmLabel="Kopieren"
      pending={copy.isPending}
      onConfirm={() =>
        copy.mutate(notebook.id, {
          onSuccess: (made) => {
            onClose();
            navigate(ROUTES.notebook(made.id));
          },
        })
      }
    />
  );
}

/** Asks before all questions and answers of the notebook are deleted. */
export function ClearChatDialog({ notebook, open, onClose }: NotebookDialogProps) {
  const clear = useClearChat(notebook.id);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Chatverlauf löschen?"
      description={
        clear.isError
          ? describeError(clear.error)
          : 'Alle Fragen und Antworten dieses Notizbuchs werden gelöscht. Quellen und Notizen bleiben. Das lässt sich nicht rückgängig machen.'
      }
      pending={clear.isPending}
      onConfirm={() => clear.mutate(undefined, { onSuccess: onClose })}
    />
  );
}
