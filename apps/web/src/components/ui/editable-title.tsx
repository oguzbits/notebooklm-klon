import { type KeyboardEvent, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * A title that is a field at the same time, like in the original: click it, type, leave it or press
 * Enter to save, Escape takes the change back. `onSave` gets the new title (trimmed, not empty, not
 * the old one) and a function that puts the old title back when saving fails. A title that changed
 * elsewhere (`value`) is taken over.
 */
export function EditableTitle({
  value,
  label,
  saving,
  error,
  onSave,
  className,
  maxLength = 200,
}: {
  value: string;
  /** Names the field for screen readers ("Titel des Notebooks"). */
  label: string;
  saving: boolean;
  error?: string | null;
  onSave: (title: string, revert: () => void) => void;
  className?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // Escape leaves the field too, and that must not save what was typed.
  const cancelled = useRef(false);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const title = draft.trim();
    if (title === '' || title === value) {
      setDraft(value);
      return;
    }
    onSave(title, () => setDraft(value));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      cancelled.current = true;
      setDraft(value);
      event.currentTarget.blur();
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        aria-label={label}
        value={draft}
        maxLength={maxLength}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={cn(
          'veil w-full min-w-0 truncate rounded-lg bg-transparent outline-none focus-visible:outline-3 focus-visible:outline-ring disabled:opacity-70',
          className
        )}
      />
      {error && (
        <p role="alert" className="absolute top-full left-2 z-10 text-small text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
