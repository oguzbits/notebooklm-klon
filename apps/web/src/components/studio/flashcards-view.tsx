import type { Flashcards } from '@nlm/shared';
import type { KeyboardEvent } from 'react';

import { CitedBy } from '@/components/studio/cited-by';
import { FlashcardControls } from '@/components/studio/flashcard-controls';
import { FlashcardFace } from '@/components/studio/flashcard-face';
import { useFlashcardDeck } from '@/hooks/use-flashcard-deck';
import { explainCardPrompt } from '@/lib/explain-prompts';
import { downloadFlashcards } from '@/lib/flashcards-export';
import { shuffle } from '@/lib/shuffle';

/**
 * Flashcards one by one, like the original: a dark card on a dark stage with the position in the set,
 * a click turns it, the round buttons go back, mark "nicht verstanden" or "verstanden" (both go on
 * to the next card) and forward. The menu of the card starts the set over, mixes it or downloads it.
 */
export function FlashcardsView({
  notebookId,
  title,
  flashcards,
  onOpenCitation,
  onAsk,
}: {
  notebookId: string;
  /** Names the downloaded file. */
  title: string;
  flashcards: Flashcards;
  onOpenCitation: (chunkId: string) => void;
  /** Asks the chat a question (the card is explained there). */
  onAsk: (question: string) => void;
}) {
  const deck = useFlashcardDeck(flashcards.cards);
  const { card } = deck;
  if (!card) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only the keys of the view itself: a key typed in a button or the menu is theirs.
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight') deck.go(1);
    else if (event.key === 'ArrowLeft') deck.go(-1);
    else if (event.key === ' ' || event.key === 'Enter') deck.flip();
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="group"
      aria-label="Lernkarten"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4 rounded-2xl bg-stage bg-[radial-gradient(70%_35%_at_50%_100%,var(--stage-glow),transparent)] p-4 text-flashcard-foreground"
    >
      <FlashcardFace
        front={card.front}
        back={card.back}
        position={`${deck.index + 1} von ${deck.cards.length}`}
        turned={deck.turned}
        onFlip={deck.flip}
        onExplain={() => onAsk(explainCardPrompt(card))}
        menu={{
          onRestart: () => deck.restart(flashcards.cards),
          onShuffle: () => deck.restart(shuffle(deck.cards)),
          onDownload: () => downloadFlashcards(title, flashcards.cards),
        }}
      />
      <FlashcardControls
        first={deck.index === 0}
        last={deck.last}
        missed={deck.missed}
        known={deck.known}
        onGo={deck.go}
        onMark={deck.mark}
      />
      <p className="text-ui text-flashcard-foreground/60">
        Belegt durch:{' '}
        <CitedBy notebookId={notebookId} chunkIds={card.chunkIds} onOpen={onOpenCitation} />
      </p>
    </div>
  );
}
