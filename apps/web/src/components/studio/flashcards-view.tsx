import type { Flashcards } from '@nlm/shared';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  EllipsisVertical,
  RotateCcw,
  Shuffle,
  Sparkles,
  X,
} from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

import { CitedBy } from '@/components/studio/cited-by';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toCsv } from '@/lib/csv';
import { download } from '@/lib/download';
import { shuffle } from '@/lib/shuffle';
import { cn } from '@/lib/utils';

const ROUND =
  'size-[58px] rounded-full border border-flashcard-foreground/25 text-flashcard-foreground';

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
  const [cards, setCards] = useState(flashcards.cards);
  const [index, setIndex] = useState(0);
  const [turned, setTurned] = useState(false);
  const [missed, setMissed] = useState(0);
  const [known, setKnown] = useState(0);
  const card = cards[index];
  if (!card) return null;

  const last = index === cards.length - 1;
  const go = (step: number) => {
    setIndex((value) => Math.min(cards.length - 1, Math.max(0, value + step)));
    setTurned(false);
  };
  const mark = (understood: boolean) => {
    if (understood) setKnown((count) => count + 1);
    else setMissed((count) => count + 1);
    if (!last) go(1);
  };
  const restart = (order: typeof cards) => {
    setCards(order);
    setIndex(0);
    setTurned(false);
    setMissed(0);
    setKnown(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Only the keys of the view itself: a key typed in a button or the menu is theirs.
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowRight') go(1);
    else if (event.key === 'ArrowLeft') go(-1);
    else if (event.key === ' ' || event.key === 'Enter') setTurned((value) => !value);
    else return;
    event.preventDefault();
  };

  const explain = () =>
    onAsk(
      `Erkläre mir diese Karteikarte genauer. Vorderseite: „${card.front}“ Rückseite: „${card.back}“`
    );

  return (
    <div
      role="group"
      aria-label="Lernkarten"
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4 rounded-2xl bg-stage bg-[radial-gradient(70%_35%_at_50%_100%,rgb(70_120_100/0.28),transparent)] p-4 text-flashcard-foreground"
    >
      <div
        className={cn(
          'relative flex min-h-[430px] flex-col rounded-3xl p-6 text-left',
          turned ? 'border border-flashcard-foreground/25' : 'bg-flashcard'
        )}
      >
        <button
          type="button"
          onClick={() => setTurned((value) => !value)}
          aria-label={
            turned ? 'Aktivieren, um die Frage zu sehen' : 'Aktivieren, um die Antwort zu sehen'
          }
          className="absolute inset-0 rounded-3xl"
        />
        <div className="pointer-events-none relative flex items-start justify-between">
          <span className="text-small text-flashcard-foreground/60" aria-live="polite">
            {index + 1} von {cards.length}
          </span>
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
              <DropdownMenuItem onSelect={() => restart(flashcards.cards)}>
                <RotateCcw aria-hidden />
                Set neu starten
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => restart(shuffle(cards))}>
                <Shuffle aria-hidden />
                Set mischen
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  download(
                    `${title}.csv`,
                    new Blob(
                      [
                        toCsv(
                          ['Vorderseite', 'Rückseite'],
                          flashcards.cards.map((entry) => [entry.front, entry.back])
                        ),
                      ],
                      { type: 'text/csv;charset=utf-8' }
                    )
                  )
                }
              >
                <Download aria-hidden />
                Set herunterladen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="pointer-events-none relative flex flex-1 flex-col justify-center gap-5 py-6">
          <p className="text-[2rem] leading-[3rem] font-[450]">{turned ? card.back : card.front}</p>
          {turned && (
            <Button
              variant="outline"
              size="sm"
              onClick={explain}
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
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          aria-label="Vorherige Karte"
          disabled={index === 0}
          onClick={() => go(-1)}
          className={cn(ROUND, 'text-action')}
        >
          <ArrowLeft className="size-6" />
        </Button>
        <Button
          variant="ghost"
          aria-label="Nicht verstanden"
          onClick={() => mark(false)}
          className={cn(ROUND, 'w-[75px] gap-2 text-stage-wrong')}
        >
          <X className="size-6" aria-hidden />
          <span>{missed}</span>
        </Button>
        <Button
          variant="ghost"
          aria-label="Verstanden"
          onClick={() => mark(true)}
          className={cn(ROUND, 'w-[75px] gap-2 text-stage-right')}
        >
          <span>{known}</span>
          <Check className="size-6" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          aria-label="Nächste Karte"
          disabled={last}
          onClick={() => go(1)}
          className={cn(ROUND, 'text-action')}
        >
          <ArrowRight className="size-6" />
        </Button>
      </div>
      <p className="text-ui text-flashcard-foreground/60">
        Belegt durch:{' '}
        <CitedBy notebookId={notebookId} chunkIds={card.chunkIds} onOpen={onOpenCitation} />
      </p>
    </div>
  );
}
