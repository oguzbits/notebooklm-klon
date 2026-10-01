import type { StudioOutput } from '@nlm/shared';
import { NotebookText, WandSparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { LibraryRow } from '@/components/studio/library-row';
import { describeOutput, noteTitle } from '@/components/studio/studio-labels';
import { KIND_COLOR, KIND_ICON } from '@/components/studio/studio-tiles';
import { Button } from '@/components/ui/button';
import { ENTRY, type LibraryEntry, type OpenEntry } from '@/lib/library-entries';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

/** What the list says while it is empty: the place where the Studio keeps what it makes. */
export function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
      <WandSparkles className="size-8 text-link" aria-hidden />
      <p className="text-[0.875rem] leading-6 font-[500] text-link">
        Hier wird die Ausgabe von Studio gespeichert.
      </p>
      <p className="text-[0.875rem] leading-6 text-muted-foreground">
        Nachdem du Quellen hinzugefügt hast, klicke oben, um Berichte, Karteikarten, Quizze und
        Mindmaps zu erstellen.
      </p>
    </div>
  );
}

/** What a line of the list looks like, whether it is an output or a note. */
function present(entry: LibraryEntry) {
  if (entry.type === ENTRY.NOTE) {
    return {
      id: entry.note.id,
      icon: NotebookText,
      iconClassName: 'text-foreground',
      title: noteTitle(entry.note),
    };
  }
  const { output } = entry;
  return {
    id: output.id,
    icon: KIND_ICON[output.kind],
    iconClassName: KIND_COLOR[output.kind],
    title: output.title,
  };
}

const subtitle = (entry: LibraryEntry) =>
  entry.type === ENTRY.NOTE
    ? relativeTime(entry.note.createdAt)
    : [describeOutput(entry.output), relativeTime(entry.output.createdAt)]
        .filter((part) => part !== '')
        .join(' · ');

export interface LibraryActions {
  onOpen: (entry: OpenEntry) => void;
  onRename: (output: StudioOutput) => void;
  onDelete: (entry: LibraryEntry) => void;
}

/** The list of the Studio: every output and note with its menu. */
export function LibraryRows({
  entries,
  deletingId,
  actions,
}: {
  entries: LibraryEntry[];
  /** The line whose deletion is under way. */
  deletingId: string | null;
  actions: LibraryActions;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {entries.map((entry) => {
        const { id, icon, iconClassName, title } = present(entry);
        return (
          <LibraryRow
            key={id}
            icon={icon}
            iconClassName={iconClassName}
            title={title}
            subtitle={subtitle(entry)}
            unread={entry.type === ENTRY.OUTPUT && entry.output.unread}
            deleting={deletingId === id}
            onOpen={() => actions.onOpen({ type: entry.type, id })}
            onRename={
              entry.type === ENTRY.OUTPUT ? () => actions.onRename(entry.output) : undefined
            }
            onDelete={() => actions.onDelete(entry)}
          />
        );
      })}
    </ul>
  );
}

/** The same lines on the rail of the folded column: one symbol each. */
export function RailEntries({
  entries,
  onOpen,
}: {
  entries: LibraryEntry[];
  onOpen: (entry: OpenEntry) => void;
}) {
  return entries.map((entry) => {
    const { id, icon: Icon, iconClassName, title } = present(entry);
    return (
      <RailButton
        key={id}
        title={title}
        onClick={() => onOpen({ type: entry.type, id })}
        icon={<Icon className={cn('size-6', iconClassName)} aria-hidden />}
      />
    );
  });
}

/** What an output or a note is on the rail of the folded column: its symbol. */
export function RailButton({
  icon,
  title,
  onClick,
  className,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      aria-label={title}
      tooltip={title}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {icon}
    </Button>
  );
}
