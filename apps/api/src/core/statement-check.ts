/**
 * Checks of one statement that the citation contract does not cover: the same fact told twice,
 * and a number that no cited passage says. Pure and deterministic, no model call.
 */

const normalize = (text: string): string => text.normalize('NFKC').toLowerCase();

/** Words that say what a statement is about: long words and numbers like years, not filler. */
const MIN_TOPIC_WORD_LENGTH = 5;
const MIN_TOPIC_NUMBER_LENGTH = 4;
const MIN_SHARED_TOPIC_WORDS = 2;
const REPEAT_OVERLAP = 0.6;
const YEAR = /\b(?:1[5-9]|20)\d\d\b/g;

function topicWords(text: string): Set<string> {
  const words = normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(
    words.filter((word) =>
      /\d/.test(word)
        ? word.length >= MIN_TOPIC_NUMBER_LENGTH
        : word.length >= MIN_TOPIC_WORD_LENGTH
    )
  );
}

const yearsOf = (text: string): string[] => normalize(text).match(YEAR) ?? [];

/**
 * Whether two statements say the same thing in other words: they share at least two topic words
 * and most of the shorter one's. Two statements that name different years are about different
 * facts (the same measure for 2018 and 2019). A heuristic: it can miss a paraphrase, and it errs
 * on the side of keeping a statement, because dropping a different fact would be worse.
 */
export function repeatsStatement(first: string, second: string): boolean {
  const firstYears = yearsOf(first);
  const secondYears = yearsOf(second);
  if (
    firstYears.length > 0 &&
    secondYears.length > 0 &&
    (firstYears.some((year) => !secondYears.includes(year)) ||
      secondYears.some((year) => !firstYears.includes(year)))
  ) {
    return false;
  }
  const firstWords = topicWords(first);
  const secondWords = topicWords(second);
  const shared = [...firstWords].filter((word) => secondWords.has(word)).length;
  const smaller = Math.min(firstWords.size, secondWords.size);
  return shared >= MIN_SHARED_TOPIC_WORDS && shared / smaller >= REPEAT_OVERLAP;
}

/**
 * A number as digits only, so 46,2 and 46.2 are the same figure. A space between groups of three
 * digits is a thousands separator (a table column reads 46 185), so it joins the groups.
 */
const NUMBER = /\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)*/g;
const numbersOf = (text: string): string[] =>
  (text.match(NUMBER) ?? []).map((number) => number.replace(/[^\d]/g, ''));

const MIN_ROUNDED_DIGITS = 2;
const MAX_ROUNDED_SOURCE_DIGITS = 15;
const ROUND_UP_FROM = 5;

/** Digits of a figure rounded to a number of significant digits, without trailing zeros. */
function roundedTo(digits: string, count: number): string {
  const head = Number(digits.slice(0, count));
  const up = Number(digits[count]) >= ROUND_UP_FROM ? 1 : 0;
  return String(head + up).replace(/0+$/, '');
}

/** Whether a figure is the evidence figure written shorter (46,2 Millionen for 46 185 Tausend). */
function isRoundingOf(figure: string, evidence: string): boolean {
  const count = figure.replace(/0+$/, '').length;
  return (
    count >= MIN_ROUNDED_DIGITS &&
    evidence.length > count &&
    evidence.length <= MAX_ROUNDED_SOURCE_DIGITS &&
    roundedTo(evidence, count) === figure.replace(/0+$/, '')
  );
}

/**
 * The numbers of a statement that the evidence does not contain. The prompt allows a number only
 * if a cited passage says it, so one that is missing was derived or invented. A figure the passage
 * says in other units and rounded (46,2 Millionen for 46 185 Tausend) counts as said.
 */
export function findUnsupportedNumbers(statement: string, evidence: string): string[] {
  const supported = numbersOf(evidence);
  return [...new Set(numbersOf(statement))].filter(
    (number) => !supported.some((said) => said === number || isRoundingOf(number, said))
  );
}
