import type { Quiz } from '@nlm/shared';
import { Check, EllipsisVertical, Lightbulb, RotateCcw, Sparkles, X } from 'lucide-react';
import { useState } from 'react';

import { CitedBy } from '@/components/studio/cited-by';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * A quiz question by question, like the original: pick an option and every option says why it is
 * right or wrong (a quiz from before has the one explanation instead), "Weiter" goes on, "Tipp
 * anzeigen" helps before the answer and "Erklären" asks the chat afterwards.
 */
export function QuizView({
  notebookId,
  quiz,
  onOpenCitation,
  onAsk,
}: {
  notebookId: string;
  quiz: Quiz;
  onOpenCitation: (chunkId: string) => void;
  /** Asks the chat a question (the question of the quiz is explained there). */
  onAsk: (question: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [correct, setCorrect] = useState(0);
  const questions = quiz.questions;
  const question = questions[index];

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setHintShown(false);
    setCorrect(0);
  };

  if (!question) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h3 className="text-xl font-title">
          {correct} von {questions.length} richtig
        </h3>
        <Button variant="outline" onClick={restart}>
          Noch einmal
        </Button>
      </div>
    );
  }

  const answered = picked !== null;
  const last = index === questions.length - 1;
  const choose = (option: number) => {
    if (answered) return;
    setPicked(option);
    if (option === question.correctIndex) setCorrect((value) => value + 1);
  };
  const next = () => {
    setIndex((value) => value + 1);
    setPicked(null);
    setHintShown(false);
  };
  const explain = () =>
    onAsk(
      `Erkläre mir diese Quizfrage genauer: „${question.question}“ Richtige Antwort: „${question.options[question.correctIndex]}“`
    );

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex items-center justify-between text-ui text-muted-foreground">
        <span aria-live="polite">
          {index + 1} von {questions.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Weitere Optionen" tooltip="Mehr">
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={restart}>
              <RotateCcw aria-hidden />
              Quiz neu starten
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h3 className="text-read text-[1.125rem] leading-8 font-[450]">{question.question}</h3>
      <ul className="flex flex-col gap-3">
        {question.options.map((text, optionIndex) => {
          const isRight = answered && optionIndex === question.correctIndex;
          const isWrong =
            answered && optionIndex === picked && optionIndex !== question.correctIndex;
          const reason = question.rationales?.[optionIndex];
          return (
            <li key={optionIndex}>
              <button
                type="button"
                onClick={() => choose(optionIndex)}
                disabled={answered}
                className={cn(
                  'flex w-full flex-col gap-2 rounded-2xl border-2 border-transparent bg-secondary px-4 py-3 text-left text-ui disabled:opacity-100',
                  !answered && 'veil',
                  isRight && 'border-success',
                  isWrong && 'border-destructive'
                )}
              >
                <span>
                  {LETTERS[optionIndex]}. {text}
                </span>
                {(isRight || isWrong) && (
                  <span
                    className={cn(
                      'flex items-center gap-2 font-title',
                      isRight ? 'text-success' : 'text-destructive'
                    )}
                  >
                    {isRight ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <X className="size-4" aria-hidden />
                    )}
                    {isRight ? 'Richtige Antwort' : 'Nicht ganz'}
                  </span>
                )}
                {answered && reason && (
                  <span className="text-[0.875rem] leading-6 text-muted-foreground">{reason}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {!answered && question.hint && (
        <div className="flex flex-col items-start gap-2">
          <Button variant="ghost" size="sm" onClick={() => setHintShown((value) => !value)}>
            <Lightbulb aria-hidden />
            {hintShown ? 'Tipp verbergen' : 'Tipp anzeigen'}
          </Button>
          {hintShown && <p className="px-3 text-[0.875rem] leading-6">{question.hint}</p>}
        </div>
      )}
      {answered && (
        <div className="flex flex-col items-start gap-3" role="status">
          {!question.rationales && (
            <p className="rounded-2xl bg-secondary p-4 text-ui">{question.explanation}</p>
          )}
          <Button variant="outline" size="sm" onClick={explain}>
            <Sparkles aria-hidden />
            Erklären
          </Button>
          <p className="text-ui text-muted-foreground">
            Belegt durch:{' '}
            <CitedBy notebookId={notebookId} chunkIds={question.chunkIds} onOpen={onOpenCitation} />
          </p>
        </div>
      )}
      <div className="sticky bottom-0 mt-auto flex justify-center bg-gradient-to-t from-card via-card/95 to-transparent pt-4 pb-1">
        <Button
          size="lg"
          onClick={next}
          className="w-61 bg-action text-action-foreground hover:opacity-90"
        >
          {last ? 'Ergebnis anzeigen' : 'Weiter'}
        </Button>
      </div>
    </div>
  );
}
