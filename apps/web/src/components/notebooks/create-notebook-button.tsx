import { Plus } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useCreateNotebook } from '@/hooks/use-notebooks';
import { describeError } from '@/lib/messages';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

/** The title of a notebook that was just made; it is renamed in its header. */
export const UNTITLED_NOTEBOOK = 'Unbenanntes Notebook';

/**
 * Makes an untitled notebook at once and opens it, like the original. Only a failure asks
 * something: the dialog tells what went wrong and offers another try.
 */
export function CreateNotebookButton({
  label,
  variant,
  className,
}: {
  label: string;
  variant: ComponentProps<typeof Button>['variant'];
  className?: string;
}) {
  const navigate = useNavigate();
  const create = useCreateNotebook();
  const [failed, setFailed] = useState(false);

  const make = () =>
    create.mutate(UNTITLED_NOTEBOOK, {
      onSuccess: (notebook) => {
        setFailed(false);
        navigate(ROUTES.notebook(notebook.id));
      },
      onError: () => setFailed(true),
    });

  return (
    <>
      {/* Below the wide layout only the icon shows: then it is a round button with an even padding. */}
      <Button
        variant={variant}
        className={cn(className, 'max-wide:w-9 max-wide:px-0 max-wide:has-[>svg]:px-0')}
        disabled={create.isPending}
        onClick={make}
      >
        <Plus />
        <span className="max-wide:sr-only">{label}</span>
      </Button>
      <ConfirmDialog
        open={failed}
        onOpenChange={setFailed}
        title="Notebook konnte nicht erstellt werden"
        description={create.isError ? describeError(create.error) : ''}
        confirmLabel="Erneut versuchen"
        pending={create.isPending}
        onConfirm={make}
      />
    </>
  );
}
