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

/**
 * The frame around one output in full, in place of the list, like in the original: the title as a
 * field with its tools, the chip that shows how it was made, the content that scrolls, and the two
 * buttons that rate it. The path back lives in the header of the column.
 */
export function ViewerFrame({
  notebookId,
  title,
  titleLabel,
  renaming,
  renameError,
  onRename,
  request,
  withPrompt,
  feedback,
  feedbackNoun,
  onFeedback,
  actions,
  onMaximize,
  deleting,
  onDelete,
  children,
}: {
  notebookId: string;
  title: string;
  titleLabel: string;
  renaming: boolean;
  renameError: string | null;
  onRename: (title: string, revert: () => void) => void;
  /** Null for an output from before the request was kept: there is nothing to show then. */
  request: StudioRequest | null;
  /** Shows the prompt too, not just the sources (reports do, in the original). */
  withPrompt: boolean;
  feedback: StudioFeedback | null;
  /** "Bericht" for a report, "Inhalt" for the rest: "Guter Bericht". */
  feedbackNoun: string;
  onFeedback: (feedback: StudioFeedback | null) => void;
  /** Buttons of the view next to the title, before the menu (copying a report). */
  actions?: ReactNode;
  onMaximize?: () => void;
  deleting: boolean;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-col gap-1 px-1 pt-1 pb-3">
        <div className="flex items-center gap-1">
          <EditableTitle
            value={title}
            label={titleLabel}
            saving={renaming}
            error={renameError}
            onSave={onRename}
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
        </div>
        {request && (
          <div className="px-2">
            <PromptChip notebookId={notebookId} request={request} withPrompt={withPrompt} />
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">{children}</div>
      <div className="flex shrink-0 flex-wrap gap-3 border-t border-border px-1 pt-3 pb-1">
        <FeedbackButton
          noun={feedbackNoun}
          value={STUDIO_FEEDBACK.GOOD}
          chosen={feedback}
          onChange={onFeedback}
        />
        <FeedbackButton
          noun={feedbackNoun}
          value={STUDIO_FEEDBACK.BAD}
          chosen={feedback}
          onChange={onFeedback}
        />
      </div>
    </div>
  );
}
