import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ROUND =
  'size-[58px] rounded-full border border-flashcard-foreground/25 text-flashcard-foreground';

/** The round buttons under the card: back, not understood, understood, forward. */
export function FlashcardControls({
  first,
  last,
  missed,
  known,
  onGo,
  onMark,
}: {
  first: boolean;
  last: boolean;
  missed: number;
  known: number;
  onGo: (step: number) => void;
  onMark: (understood: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <Button
        variant="ghost"
        aria-label="Vorherige Karte"
        disabled={first}
        onClick={() => onGo(-1)}
        className={cn(ROUND, 'text-action')}
      >
        <ArrowLeft className="size-6" />
      </Button>
      <Button
        variant="ghost"
        aria-label="Nicht verstanden"
        onClick={() => onMark(false)}
        className={cn(ROUND, 'w-[75px] gap-2 text-stage-wrong')}
      >
        <X className="size-6" aria-hidden />
        <span>{missed}</span>
      </Button>
      <Button
        variant="ghost"
        aria-label="Verstanden"
        onClick={() => onMark(true)}
        className={cn(ROUND, 'w-[75px] gap-2 text-stage-right')}
      >
        <span>{known}</span>
        <Check className="size-6" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        aria-label="Nächste Karte"
        disabled={last}
        onClick={() => onGo(1)}
        className={cn(ROUND, 'text-action')}
      >
        <ArrowRight className="size-6" />
      </Button>
    </div>
  );
}
