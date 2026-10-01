import { type FormEvent, useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MAX_TITLE_CHARS = 200;

/**
 * A dialog with one field for a new name, saved with the button or the Enter key. It closes itself
 * when the name did not change; otherwise the owner saves and calls `close` once that worked.
 */
export function RenameDialog({
  heading,
  label,
  value,
  open,
  onOpenChange,
  onSave,
  pending,
  error,
}: {
  /** What the dialog is called, for example "Quelle umbenennen". */
  heading: string;
  /** The label of the field. */
  label: string;
  /** The name as it is now. */
  value: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, close: () => void) => void;
  pending: boolean;
  /** What went wrong when saving, in words; null while nothing did. */
  error: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {open && (
          <RenameForm
            heading={heading}
            label={label}
            value={value}
            onSave={onSave}
            pending={pending}
            error={error}
            close={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  heading,
  label,
  value,
  onSave,
  pending,
  error,
  close,
}: {
  heading: string;
  label: string;
  value: string;
  onSave: (title: string, close: () => void) => void;
  pending: boolean;
  error: string | null;
  close: () => void;
}) {
  const [text, setText] = useState(value);
  const clean = text.trim();

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (clean === '' || pending) return;
    if (clean === value) return close();
    onSave(clean, close);
  };

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{heading}</DialogTitle>
        <DialogDescription className="sr-only">Gib einen neuen Namen ein.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="rename-field">{label}</Label>
        <Input
          id="rename-field"
          value={text}
          maxLength={MAX_TITLE_CHARS}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="submit" disabled={clean === '' || pending}>
          Speichern
        </Button>
      </DialogFooter>
    </form>
  );
}
