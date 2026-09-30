import { REPORT_FORMAT, type ReportFormat } from '@nlm/shared';
import { Check, FileText } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { FORMAT_DESCRIPTION, FORMAT_LABEL } from '@/components/studio/studio-labels';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * "Bericht erstellen": pick a template, then "Generieren". Like in NotebookLM the Studio asks
 * before it makes a report; the trigger is the tile that is passed in.
 */
export function ReportDialog({
  children,
  onCreate,
}: {
  children: ReactNode;
  onCreate: (format: ReportFormat) => void;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ReportFormat>(REPORT_FORMAT.BRIEFING);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-[720px]">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border px-6 py-4">
          <FileText className="size-6 text-studio-pink" aria-hidden />
          <DialogTitle>Bericht erstellen</DialogTitle>
          <DialogDescription className="sr-only">
            Wähle eine Vorlage. Der Bericht stützt sich nur auf die ausgewählten Quellen.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 py-5">
          <p className="text-[0.875rem] leading-6 font-[500]" id="report-template">
            Vorlage
          </p>
          <div
            role="radiogroup"
            aria-labelledby="report-template"
            className="grid gap-2 sm:grid-cols-3"
          >
            {Object.values(REPORT_FORMAT).map((option) => {
              const selected = option === format;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setFormat(option)}
                  className={cn(
                    'flex flex-col gap-1 rounded-3xl border p-4 text-left',
                    selected
                      ? 'border-transparent bg-selected text-selected-foreground'
                      : 'veil border-border'
                  )}
                >
                  <span className="flex items-center justify-between gap-2 text-[1rem] leading-8 font-[500]">
                    {FORMAT_LABEL[option]}
                    <span
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full',
                        selected ? 'bg-card' : 'bg-accent'
                      )}
                    >
                      {selected && <Check className="size-3.5" aria-hidden />}
                    </span>
                  </span>
                  <span className="text-small text-muted-foreground">
                    {FORMAT_DESCRIPTION[option]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end border-t border-border px-6 py-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setOpen(false);
              onCreate(format);
            }}
          >
            Generieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
