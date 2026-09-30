import type { Quiz } from '@nlm/shared';
import { Check, X } from 'lucide-react';
import { useState } from 'react';

import { CitedBy } from '@/components/studio/cited-by';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A quiz question by question: pick an option, see whether it was right and why, go on. */
export function QuizView({
  notebookId,
  quiz,
  onOpenCitation,
}: {
  notebookId: string;
  quiz: Quiz;
  onOpenCitation: (chunkId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const questions = quiz.questions;
  const question = questions[index];

  if (!question) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h3 className="text-xl font-medium">
          {correct} von {questions.length} richtig
        </h3>
        <Button
          variant="outline"
          onClick={() => {
            setIndex(0);
            setPicked(null);
            setCorrect(0);
          }}
        >
          Noch einmal
        </Button>
      </div>
    );
  }

  const answered = picked !== null;
  const choose = (option: number) => {
    if (answered) return;
    setPicked(option);
    if (option === question.correctIndex) setCorrect((value) => value + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Frage {index + 1} von {questions.length}
      </p>
      <h3 className="text-lg leading-snug font-medium">{question.question}</h3>
      <ul className="flex flex-col gap-2">
        {question.options.map((option, optionIndex) => {
          const isRight = answered && optionIndex === question.correctIndex;
          const isWrong =
            answered && optionIndex === picked && optionIndex !== question.correctIndex;
          return (
            <li key={optionIndex}>
              <button
                type="button"
                onClick={() => choose(optionIndex)}
                aria-disabled={answered}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border border-input px-4 py-3 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  !answered && 'hover:bg-accent/60',
                  isRight && 'border-success bg-success/10',
                  isWrong && 'border-destructive bg-destructive/10'
                )}
              >
                <span className="flex-1">{option}</span>
                {isRight && <Check className="size-4 text-success" aria-label="richtig" />}
                {isWrong && <X className="size-4 text-destructive" aria-label="falsch" />}
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4 text-sm" role="status">
          <p>{question.explanation}</p>
          <p className="text-muted-foreground">
            Belegt durch:{' '}
            <CitedBy notebookId={notebookId} chunkIds={question.chunkIds} onOpen={onOpenCitation} />
          </p>
          <Button
            className="self-start"
            onClick={() => {
              setIndex((value) => value + 1);
              setPicked(null);
            }}
          >
            {index === questions.length - 1 ? 'Ergebnis anzeigen' : 'Weiter'}
          </Button>
        </div>
      )}
    </div>
  );
}
