import { Check, type LucideIcon, X } from 'lucide-react';

import { cn } from '@/lib/utils';

const LETTERS = ['A', 'B', 'C', 'D'] as const;

const VERDICT = { RIGHT: 'RIGHT', WRONG: 'WRONG' } as const;
export type Verdict = (typeof VERDICT)[keyof typeof VERDICT];

/** What an answered option says about itself: it is the right one, or the one picked in error. */
const SHOWN: Record<Verdict, { icon: LucideIcon; label: string; text: string; border: string }> = {
  [VERDICT.RIGHT]: {
    icon: Check,
    label: 'Richtige Antwort',
    text: 'text-success',
    border: 'border-success',
  },
  [VERDICT.WRONG]: {
    icon: X,
    label: 'Nicht ganz',
    text: 'text-destructive',
    border: 'border-destructive',
  },
};

/** The verdict on an option once the question is answered; none for the others. */
export function verdictOf(
  optionIndex: number,
  picked: number | null,
  correctIndex: number
): Verdict | null {
  if (picked === null) return null;
  if (optionIndex === correctIndex) return VERDICT.RIGHT;
  return optionIndex === picked ? VERDICT.WRONG : null;
}

/** One option of a question: pick it, and once answered it says why it is right or wrong. */
export function QuizOption({
  index,
  text,
  verdict,
  answered,
  reason,
  onChoose,
}: {
  index: number;
  text: string;
  verdict: Verdict | null;
  answered: boolean;
  /** Why this option is right or wrong; quizzes from before have none. */
  reason: string | undefined;
  onChoose: () => void;
}) {
  const shown = verdict ? SHOWN[verdict] : null;
  return (
    <li>
      <button
        type="button"
        onClick={onChoose}
        disabled={answered}
        className={cn(
          'flex w-full flex-col gap-2 rounded-2xl border-2 border-transparent bg-secondary px-4 py-3 text-left text-ui disabled:opacity-100',
          !answered && 'veil',
          shown?.border
        )}
      >
        <span>
          {LETTERS[index]}. {text}
        </span>
        {shown && (
          <span className={cn('flex items-center gap-2 font-title', shown.text)}>
            <shown.icon className="size-4" aria-hidden />
            {shown.label}
          </span>
        )}
        {answered && reason && (
          <span className="text-[0.875rem] leading-6 text-muted-foreground">{reason}</span>
        )}
      </button>
    </li>
  );
}
