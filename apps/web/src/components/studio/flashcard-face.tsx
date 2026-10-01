import { Download, EllipsisVertical, RotateCcw, Shuffle, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** The menu of the card: start the set over, mix it, or download it. */
function FlashcardMenu({
  onRestart,
  onShuffle,
  onDownload,
}: {
  onRestart: () => void;
  onShuffle: () => void;
  onDownload: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Weitere Optionen"
          className="pointer-events-auto -mt-1 -mr-2 text-flashcard-foreground"
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onSelect={onRestart}>
          <RotateCcw aria-hidden />
          Set neu starten
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onShuffle}>
          <Shuffle aria-hidden />
          Set mischen
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDownload}>
          <Download aria-hidden />
          Set herunterladen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The card itself: a click turns it; on the back, "Erklären" asks the chat about it. */
export function FlashcardFace({
  front,
  back,
  position,
  turned,
  onFlip,
  onExplain,
  menu,
}: {
  front: string;
  back: string;
  /** "3 von 12". */
  position: string;
  turned: boolean;
  onFlip: () => void;
  onExplain: () => void;
  menu: Parameters<typeof FlashcardMenu>[0];
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-[430px] flex-col rounded-3xl p-6 text-left',
        turned ? 'border border-flashcard-foreground/25' : 'bg-flashcard'
      )}
    >
      <button
        type="button"
        onClick={onFlip}
        aria-label={
          turned ? 'Aktivieren, um die Frage zu sehen' : 'Aktivieren, um die Antwort zu sehen'
        }
        className="absolute inset-0 rounded-3xl"
      />
      <div className="pointer-events-none relative flex items-start justify-between">
        <span className="text-small text-flashcard-foreground/60" aria-live="polite">
          {position}
        </span>
        <FlashcardMenu {...menu} />
      </div>
      <div className="pointer-events-none relative flex flex-1 flex-col justify-center gap-5 py-6">
        <p className="text-[2rem] leading-[3rem] font-[450]">{turned ? back : front}</p>
        {turned && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExplain}
            className="pointer-events-auto w-fit border-flashcard-foreground/40 text-flashcard-foreground text-small"
          >
            <Sparkles aria-hidden />
            Erklären
          </Button>
        )}
      </div>
      {!turned && (
        <span className="pointer-events-none relative self-center text-ui text-flashcard-foreground/60">
          Antwort ansehen
        </span>
      )}
    </div>
  );
}
