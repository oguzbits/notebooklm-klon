import type { Flashcards } from '@nlm/shared';
import { useState } from 'react';

type Cards = Flashcards['cards'];

/** The cards of a set one by one: which is shown, whether it is turned, and what was marked. */
export function useFlashcardDeck(initial: Cards) {
  const [cards, setCards] = useState(initial);
  const [index, setIndex] = useState(0);
  const [turned, setTurned] = useState(false);
  const [missed, setMissed] = useState(0);
  const [known, setKnown] = useState(0);
  const last = index === cards.length - 1;

  const go = (step: number) => {
    setIndex((value) => Math.min(cards.length - 1, Math.max(0, value + step)));
    setTurned(false);
  };
  const flip = () => setTurned((value) => !value);
  /** Marks the card as understood or not and goes on to the next one, unless it was the last. */
  const mark = (understood: boolean) => {
    if (understood) setKnown((count) => count + 1);
    else setMissed((count) => count + 1);
    if (!last) go(1);
  };
  const restart = (order: Cards) => {
    setCards(order);
    setIndex(0);
    setTurned(false);
    setMissed(0);
    setKnown(0);
  };

  return { cards, card: cards[index], index, turned, missed, known, last, go, flip, mark, restart };
}
