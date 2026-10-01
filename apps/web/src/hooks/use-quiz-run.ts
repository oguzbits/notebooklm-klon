import type { Quiz } from '@nlm/shared';
import { useState } from 'react';

/** A quiz question by question: which one is shown, what was picked, the hint, and the score. */
export function useQuizRun(quiz: Quiz) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [correct, setCorrect] = useState(0);
  const question = quiz.questions[index];

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setHintShown(false);
    setCorrect(0);
  };
  /** Picks an option; the first pick counts, the score goes up when it is the right one. */
  const choose = (option: number) => {
    if (picked !== null || !question) return;
    setPicked(option);
    if (option === question.correctIndex) setCorrect((value) => value + 1);
  };
  const next = () => {
    setIndex((value) => value + 1);
    setPicked(null);
    setHintShown(false);
  };
  const toggleHint = () => setHintShown((value) => !value);

  return {
    question,
    index,
    total: quiz.questions.length,
    picked,
    answered: picked !== null,
    last: index === quiz.questions.length - 1,
    hintShown,
    correct,
    restart,
    choose,
    next,
    toggleHint,
  };
}
