/**
 * Pure, deterministic eval scorers. No I/O, no model calls.
 *
 * A ratio whose denominator is zero is `null` ("not applicable"), never 0 or 1, so an empty
 * answer or an empty fact list cannot inflate or deflate an average.
 */

export interface RetrievedChunk {
  id: string;
  text: string;
}

export interface CitedStatement {
  text: string;
  chunkIds: string[];
}

export interface RetrievalScore {
  /** At least one expected anchor appears in the top k chunks. */
  hit: boolean;
  /** 1-based rank of the first top-k chunk that contains an anchor, otherwise null. */
  rank: number | null;
  /** Share of expected anchors found somewhere in the top k chunks. */
  anchorRecall: number | null;
}

export interface CitationScore {
  statements: number;
  citations: number;
  invalidCitations: number;
  /** Valid citations / all citations. */
  validity: number | null;
  /** Statements with at least one valid citation / all statements. */
  coverage: number | null;
}

export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function scoreRetrieval(
  retrieved: RetrievedChunk[],
  expectedAnchors: string[],
  k: number
): RetrievalScore {
  const topK = retrieved.slice(0, k).map((chunk) => normalizeText(chunk.text));
  const anchors = expectedAnchors.map(normalizeText);

  const firstMatch = topK.findIndex((text) => anchors.some((anchor) => text.includes(anchor)));
  const found = anchors.filter((anchor) => topK.some((text) => text.includes(anchor))).length;

  return {
    hit: firstMatch >= 0,
    rank: firstMatch >= 0 ? firstMatch + 1 : null,
    anchorRecall: ratio(found, anchors.length),
  };
}

export function scoreCitations(
  statements: CitedStatement[],
  contextChunkIds: string[]
): CitationScore {
  const context = new Set(contextChunkIds);
  const citations = statements.flatMap((statement) => statement.chunkIds);
  const invalidCitations = citations.filter((id) => !context.has(id)).length;
  const coveredStatements = statements.filter((statement) =>
    statement.chunkIds.some((id) => context.has(id))
  ).length;

  return {
    statements: statements.length,
    citations: citations.length,
    invalidCitations,
    validity: ratio(citations.length - invalidCitations, citations.length),
    coverage: ratio(coveredStatements, statements.length),
  };
}

export function scoreRequiredFacts(
  answer: string,
  requiredFacts: (string | string[])[]
): number | null {
  const normalizedAnswer = normalizeText(answer);
  const present = requiredFacts.filter((fact) =>
    [fact].flat().some((spelling) => normalizedAnswer.includes(normalizeText(spelling)))
  );
  return ratio(present.length, requiredFacts.length);
}

/** Words that say what a statement is about: long words and numbers like years, not filler. */
const MIN_TOPIC_WORD_LENGTH = 5;
const MIN_TOPIC_NUMBER_LENGTH = 4;
const MIN_SHARED_TOPIC_WORDS = 2;
const REPEAT_OVERLAP = 0.6;

function topicWords(text: string): Set<string> {
  const words = normalizeText(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(
    words.filter((word) =>
      /\d/.test(word)
        ? word.length >= MIN_TOPIC_NUMBER_LENGTH
        : word.length >= MIN_TOPIC_WORD_LENGTH
    )
  );
}

/**
 * Pairs of statements that say about the same thing: they share at least two topic words and most
 * of the shorter one's. A heuristic that finds the same fact restated in other words; it can
 * miss a paraphrase and flag two statements that only look alike, so it is a signal, not a gate.
 */
export function countRepeatedStatements(statements: CitedStatement[]): number {
  const words = statements.map((statement) => topicWords(statement.text));
  let repeated = 0;
  words.forEach((first, index) => {
    for (const second of words.slice(index + 1)) {
      const shared = [...first].filter((word) => second.has(word)).length;
      const smaller = Math.min(first.size, second.size);
      if (shared >= MIN_SHARED_TOPIC_WORDS && shared / smaller >= REPEAT_OVERLAP) repeated += 1;
    }
  });
  return repeated;
}

/** A number as digits only, so 46,2 and 46.2 are the same figure. */
const numbersOf = (text: string): string[] =>
  (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((number) => number.replace(/[.,]/g, ''));

/**
 * The numbers of the answer that no cited passage contains. The prompt allows a number only if a
 * cited passage says it, so one that is missing was derived or invented (or rounded).
 */
export function findUnsupportedNumbers(answer: string, citedText: string): string[] {
  const supported = new Set(numbersOf(citedText));
  return [...new Set(numbersOf(answer))].filter((number) => !supported.has(number));
}

/** The forbidden strings (a plausible wrong figure, an injected word) that the answer contains. */
export function findForbiddenFacts(answer: string, forbiddenFacts: string[]): string[] {
  const normalizedAnswer = normalizeText(answer);
  return forbiddenFacts.filter((fact) => normalizedAnswer.includes(normalizeText(fact)));
}
