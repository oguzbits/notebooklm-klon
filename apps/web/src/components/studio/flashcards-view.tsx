import type { Flashcards } from '@nlm/shared';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useState } from 'react';

import { CitedBy } from '@/components/studio/cited-by';
import { Button } from '@/components/ui/button';

/** Flashcards one by one: the front, a click turns the card, the arrows move on. */
export function FlashcardsView({
  notebookId,
  flashcards,
  onOpenCitation,
}: {
  notebookId: string;
  flashcards: Flashcards;
  onOpenCitation: (chunkId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [turned, setTurned] = useState(false);
  const cards = flashcards.cards;
  const card = cards[index];
  if (!card) return null;

  const go = (step: number) => {
    setIndex((value) => Math.min(cards.length - 1, Math.max(0, value + step)));
    setTurned(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setTurned((value) => !value)}
        aria-label={turned ? 'Karte zur Frage umdrehen' : 'Karte zur Antwort umdrehen'}
        className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-3xl bg-secondary p-6 text-center transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="text-xs tracking-wide text-muted-foreground uppercase">
          {turned ? 'Antwort' : 'Frage'}
        </span>
        <span className="text-lg leading-snug font-medium">{turned ? card.back : card.front}</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <RotateCw className="size-3" aria-hidden />
          Zum Umdrehen tippen
        </span>
      </button>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Vorherige Karte"
          onClick={() => go(-1)}
          disabled={index === 0}
        >
          <ChevronLeft />
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Karte {index + 1} von {cards.length}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Nächste Karte"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
        >
          <ChevronRight />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Belegt durch:{' '}
        <CitedBy notebookId={notebookId} chunkIds={card.chunkIds} onOpen={onOpenCitation} />
      </p>
    </div>
  );
}
