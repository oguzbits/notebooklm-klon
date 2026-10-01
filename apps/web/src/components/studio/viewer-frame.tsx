import { STUDIO_FEEDBACK, type StudioFeedback, type StudioRequest } from '@nlm/shared';
import { EllipsisVertical, Maximize2, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { PromptChip } from '@/components/studio/prompt-chip';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EditableTitle } from '@/components/ui/editable-title';
import { cn } from '@/lib/utils';

function FeedbackButton({
  noun,
  value,
  chosen,
  onChange,
}: {
  noun: string;
  value: StudioFeedback;
  chosen: StudioFeedback | null;
  onChange: (feedback: StudioFeedback | null) => void;
}) {
  const good = value === STUDIO_FEEDBACK.GOOD;
  const Icon = good ? ThumbsUp : ThumbsDown;
  const pressed = chosen === value;
  return (
    <Button
      variant="outline"
      aria-pressed={pressed}
      onClick={() => onChange(pressed ? null : value)}
      className={cn('h-9', pressed && 'bg-accent')}
    >
      <Icon className={cn(pressed && 'fill-current')} aria-hidden />
      {good ? 'Guter' : 'Schlechter'} {noun}
    </Button>
  );
}

/** The menu next to the title: delete the output. */
function FrameMenu({ deleting, onDelete }: { deleting: boolean; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Weitere Aktionen"
          tooltip="Mehr"
          disabled={deleting}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={deleting} onSelect={onDelete}>
          <Trash2 aria-hidden />
          Löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The two buttons that rate the output ("Guter Bericht", "Schlechter Bericht"). */
function FeedbackBar({
  noun,
  chosen,
  onChange,
}: {
  noun: string;
  chosen: StudioFeedback | null;
  onChange: (feedback: StudioFeedback | null) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-3 border-t border-border px-1 pt-3 pb-1">
      <FeedbackButton
        noun={noun}
        value={STUDIO_FEEDBACK.GOOD}
        chosen={chosen}
        onChange={onChange}
      />
      <FeedbackButton noun={noun} value={STUDIO_FEEDBACK.BAD} chosen={chosen} onChange={onChange} />
    </div>
  );
}

interface TitleProps {
  text: string;
  label: string;
  saving: boolean;
  error: string | null;
  onSave: (title: string, revert: () => void) => void;
}

interface FeedbackProps {
  value: StudioFeedback | null;
  /** "Bericht" for a report, "Inhalt" for the rest: "Guter Bericht". */
  noun: string;
  onChange: (feedback: StudioFeedback | null) => void;
}

interface ViewerFrameProps {
  notebookId: string;
  title: TitleProps;
  /** Null request for an output from before the request was kept: there is nothing to show then. */
  prompt: {
    request: StudioRequest | null;
    /** Shows the prompt too, not just the sources (reports do, in the original). */
    withPrompt: boolean;
  };
  feedback: FeedbackProps;
  /** Buttons of the view next to the title, before the menu (copying a report). */
  actions?: ReactNode;
  onMaximize?: () => void;
  deletion: { pending: boolean; onDelete: () => void };
  children: ReactNode;
}

/**
 * The frame around one output in full, in place of the list, like in the original: the title as a
 * field with its tools, the chip that shows how it was made, the content that scrolls, and the two
 * buttons that rate it. The path back lives in the header of the column.
 */
export function ViewerFrame({
  notebookId,
  title,
  prompt,
  feedback,
  actions,
  onMaximize,
  deletion,
  children,
}: ViewerFrameProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-1 px-1 pt-1 pb-3">
        <div className="flex items-center gap-1">
          <EditableTitle
            value={title.text}
            label={title.label}
            saving={title.saving}
            error={title.error}
            onSave={title.onSave}
            className="h-10 px-2 text-[1.375rem] leading-9"
          />
          {actions}
          {onMaximize && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Maximieren"
              tooltip="Ansicht maximieren"
              onClick={onMaximize}
            >
              <Maximize2 />
            </Button>
          )}
          <FrameMenu deleting={deletion.pending} onDelete={deletion.onDelete} />
        </div>
        {prompt.request && (
          <div className="px-2">
            <PromptChip
              notebookId={notebookId}
              request={prompt.request}
              withPrompt={prompt.withPrompt}
            />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{children}</div>
      <FeedbackBar noun={feedback.noun} chosen={feedback.value} onChange={feedback.onChange} />
    </div>
  );
}
