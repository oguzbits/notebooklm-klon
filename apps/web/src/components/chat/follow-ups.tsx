import { CornerDownRight } from 'lucide-react';

/**
 * The cards under the last answer with questions to ask next, three in a row like in NotebookLM.
 * A card asks its question at once; each has the arrow of a follow-up at its lower left.
 */
export function FollowUps({
  questions,
  disabled,
  onAsk,
}: {
  questions: string[];
  disabled: boolean;
  onAsk: (question: string) => void;
}) {
  return (
    <ul aria-label="Vorschläge für weitere Fragen" className="mt-4 flex gap-3">
      {questions.map((question) => (
        <li key={question} className="flex flex-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAsk(question)}
            className="veil flex min-h-27 w-full flex-col justify-between gap-4 rounded-2xl bg-secondary p-5 text-left text-[0.875rem] leading-6 [font-stretch:100%] transition-colors duration-150 ease-in-out disabled:pointer-events-none disabled:opacity-50"
          >
            <span>{question}</span>
            <CornerDownRight className="size-[18px] shrink-0" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
