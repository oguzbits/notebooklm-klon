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

export function scoreRequiredFacts(answer: string, requiredFacts: string[]): number | null {
  const normalizedAnswer = normalizeText(answer);
  const present = requiredFacts.filter((fact) => normalizedAnswer.includes(normalizeText(fact)));
  return ratio(present.length, requiredFacts.length);
}
