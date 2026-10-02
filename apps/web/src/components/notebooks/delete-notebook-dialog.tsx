import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDeleteNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';

/** Asks before a notebook is deleted with its sources and its chat; `notebook` null keeps it closed. */
export function DeleteNotebookDialog({
  notebook,
  onClose,
  onDeleted,
}: {
  notebook: { id: string; title: string } | null;
  onClose: () => void;
  /** Called once the notebook is gone, for example to leave its page. */
  onDeleted?: () => void;
}) {
  const remove = useDeleteNotebook();
  return (
    <ConfirmDialog
      open={notebook !== null}
      onOpenChange={(open) => !open && onClose()}
      title="Notebook löschen?"
      description={
        remove.isError ? (
          describeError(remove.error)
        ) : (
          <>
            „{notebook?.title}“ wird mit allen Quellen und dem Verlauf der Fragen gelöscht. Das
            lässt sich nicht rückgängig machen.
          </>
        )
      }
      pending={remove.isPending}
      onConfirm={() =>
        notebook &&
        remove.mutate(notebook.id, {
          onSuccess: () => {
            onClose();
            onDeleted?.();
          },
        })
      }
    />
  );
}
