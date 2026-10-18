import { API_ERROR, USER_LIMITS } from '@nlm/shared';
import { Plus } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useCreateNotebook, useNotebooks } from '@/hooks/use-notebooks';
import { tr } from '@/lib/i18n';
import { describeError, ERROR_MESSAGE } from '@/lib/messages';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

/** The title of a notebook that was just made; it is renamed in its header. */
export const UNTITLED_NOTEBOOK = tr('Unbenanntes Notebook', 'Untitled notebook');

const LIMIT_HINT_ID = 'notebook-limit-hint';

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
  const atLimit = (useNotebooks().data?.length ?? 0) >= USER_LIMITS.NOTEBOOKS;
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
      {/* A disabled button gets no hover, so the span carries the reason as a hint. */}
      <span title={atLimit ? ERROR_MESSAGE[API_ERROR.NOTEBOOK_LIMIT_REACHED] : undefined}>
        <Button
          variant={variant}
          className={cn(className, 'max-wide:w-9 max-wide:px-0 max-wide:has-[>svg]:px-0')}
          disabled={create.isPending || atLimit}
          aria-describedby={atLimit ? LIMIT_HINT_ID : undefined}
          onClick={make}
        >
          <Plus />
          <span className="max-wide:sr-only">{label}</span>
        </Button>
        {atLimit && (
          <span id={LIMIT_HINT_ID} className="sr-only">
            {ERROR_MESSAGE[API_ERROR.NOTEBOOK_LIMIT_REACHED]}
          </span>
        )}
      </span>
      <ConfirmDialog
        open={failed}
        onOpenChange={setFailed}
        title={tr('Notebook konnte nicht erstellt werden', 'The notebook could not be created')}
        description={create.isError ? describeError(create.error) : ''}
        confirmLabel={tr('Erneut versuchen', 'Try again')}
        pending={create.isPending}
        onConfirm={make}
      />
    </>
  );
}
