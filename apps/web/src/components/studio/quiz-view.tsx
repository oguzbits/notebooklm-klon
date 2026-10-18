import type { Quiz } from '@nlm/shared';
import { EllipsisVertical, Lightbulb, RotateCcw, Sparkles } from 'lucide-react';

import { CitedBy } from '@/components/studio/cited-by';
import { QuizOption, verdictOf } from '@/components/studio/quiz-option';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuizRun } from '@/hooks/use-quiz-run';
import { explainQuizPrompt } from '@/lib/explain-prompts';
import { tr } from '@/lib/i18n';

type Question = Quiz['questions'][number];

/** The tip before the answer: hidden until it is asked for. */
function QuizHint({
  hint,
  shown,
  onToggle,
}: {
  hint: string;
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="ghost" size="sm" onClick={onToggle}>
        <Lightbulb aria-hidden />
        {shown ? tr('Tipp verbergen', 'Hide hint') : tr('Tipp anzeigen', 'Show hint')}
      </Button>
      {shown && <p className="px-3 text-[0.875rem] leading-6">{hint}</p>}
    </div>
  );
}

/** After the answer: the one explanation of an older quiz, "Explain", and the passages behind it. */
function QuizAnswer({
  notebookId,
  question,
  onExplain,
  onOpenCitation,
}: {
  notebookId: string;
  question: Question;
  onExplain: () => void;
  onOpenCitation: (chunkId: string) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3" role="status">
      {!question.rationales && (
        <p className="rounded-2xl bg-secondary p-4 text-ui">{question.explanation}</p>
      )}
      <Button variant="outline" size="sm" onClick={onExplain}>
        <Sparkles aria-hidden />
        {tr('Erklären', 'Explain')}
      </Button>
      <p className="text-ui text-muted-foreground">
        {tr('Belegt durch:', 'Backed by:')}{' '}
        <CitedBy notebookId={notebookId} chunkIds={question.chunkIds} onOpen={onOpenCitation} />
      </p>
    </div>
  );
}

/** What the quiz says at the end: the score and a way to start over. */
function QuizResult({
  correct,
  total,
  onRestart,
}: {
  correct: number;
  total: number;
  onRestart: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h3 className="text-xl font-title">
        {tr(`${correct} von ${total} richtig`, `${correct} of ${total} correct`)}
      </h3>
      <Button variant="outline" onClick={onRestart}>
        {tr('Noch einmal', 'Try again')}
      </Button>
    </div>
  );
}

/** The position in the quiz and the menu that starts it over. */
function QuizHeader({ position, onRestart }: { position: string; onRestart: () => void }) {
  return (
    <div className="flex items-center justify-between text-ui text-muted-foreground">
      <span aria-live="polite">{position}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tr('Weitere Optionen', 'More options')}
            tooltip={tr('Mehr', 'More')}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRestart}>
            <RotateCcw aria-hidden />
            {tr('Quiz neu starten', 'Restart quiz')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** "Next", or "Show result" on the last question, pinned to the lower edge. */
function QuizNext({ last, onNext }: { last: boolean; onNext: () => void }) {
  return (
    <div className="sticky bottom-0 mt-auto flex justify-center bg-gradient-to-t from-card via-card/95 to-transparent pt-4 pb-1">
      <Button
        size="lg"
        onClick={onNext}
        className="w-61 bg-action text-action-foreground hover:opacity-90"
      >
        {last ? tr('Ergebnis anzeigen', 'Show result') : tr('Weiter', 'Next')}
      </Button>
    </div>
  );
}

/**
 * A quiz question by question, like the original: pick an option and every option says why it is
 * right or wrong (a quiz from before has the one explanation instead), "Next" goes on, "Show
 * hint" helps before the answer and "Explain" asks the chat afterwards.
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
  const run = useQuizRun(quiz);
  const { question } = run;
  if (!question)
    return <QuizResult correct={run.correct} total={run.total} onRestart={run.restart} />;

  return (
    <div className="flex min-h-full flex-col gap-4">
      <QuizHeader
        position={tr(`${run.index + 1} von ${run.total}`, `${run.index + 1} of ${run.total}`)}
        onRestart={run.restart}
      />
      <h3 className="text-read text-[1.125rem] leading-8 font-[450]">{question.question}</h3>
      <ul className="flex flex-col gap-3">
        {question.options.map((text, optionIndex) => (
          <QuizOption
            key={optionIndex}
            index={optionIndex}
            text={text}
            verdict={verdictOf(optionIndex, run.picked, question.correctIndex)}
            answered={run.answered}
            reason={question.rationales?.[optionIndex]}
            onChoose={() => run.choose(optionIndex)}
          />
        ))}
      </ul>
      {!run.answered && question.hint && (
        <QuizHint hint={question.hint} shown={run.hintShown} onToggle={run.toggleHint} />
      )}
      {run.answered && (
        <QuizAnswer
          notebookId={notebookId}
          question={question}
          onExplain={() =>
            onAsk(explainQuizPrompt(question.question, question.options[question.correctIndex]))
          }
          onOpenCitation={onOpenCitation}
        />
      )}
      <QuizNext last={run.last} onNext={run.next} />
    </div>
  );
}
