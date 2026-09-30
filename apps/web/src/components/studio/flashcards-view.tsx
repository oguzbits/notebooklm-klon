import type { Flashcards } from '@nlm/shared';
import { ArrowLeft, ArrowRight } from 'lucide-react';
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
        className="flex min-h-72 flex-col rounded-3xl bg-flashcard p-6 text-left text-flashcard-foreground"
      >
        <span className="text-small text-flashcard-foreground/60" aria-live="polite">
          Karte {index + 1} von {cards.length}
        </span>
        <span className="flex flex-1 items-center py-4 text-2xl leading-10 font-[450]">
          {turned ? card.back : card.front}
        </span>
        <span className="self-center text-small text-flashcard-foreground/60">
          {turned ? 'Frage ansehen' : 'Antwort ansehen'}
        </span>
      </button>
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon-lg"
          className="size-14"
          aria-label="Vorherige Karte"
          onClick={() => go(-1)}
          disabled={index === 0}
        >
          <ArrowLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          className="size-14 border-action text-action"
          aria-label="Nächste Karte"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
        >
          <ArrowRight />
        </Button>
      </div>
      <p className="text-ui text-muted-foreground">
        Belegt durch:{' '}
        <CitedBy notebookId={notebookId} chunkIds={card.chunkIds} onOpen={onOpenCitation} />
      </p>
    </div>
  );
}
