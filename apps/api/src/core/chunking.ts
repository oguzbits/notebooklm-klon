/**
 * Chunk size in characters. 1500 characters stay far below the 2048-token input limit of the
 * smaller embedding model. Chosen for the spike corpus, not tuned.
 */
export const CHUNKING = {
  MAX_CHARS: 1500,
  OVERLAP_CHARS: 200,
} as const;

export interface TextChunk {
  ordinal: number;
  text: string;
  /** Inclusive start and exclusive end into the canonical text: text === canonical.slice(start, end). */
  startOffset: number;
  endOffset: number;
}

const PARAGRAPH_BREAK = '\n\n';
const LINE_BREAK = '\n';
const WHITESPACE = /\s/;

function isSpace(text: string, index: number): boolean {
  return WHITESPACE.test(text.charAt(index));
}

function skipSpaces(text: string, from: number): number {
  let index = from;
  while (index < text.length && isSpace(text, index)) index += 1;
  return index;
}

/** Latest natural break in the second half of the window: paragraph, then line, then space. */
function findBreak(text: string, start: number, hardEnd: number): number {
  const earliest = start + Math.floor(CHUNKING.MAX_CHARS / 2);
  for (const separator of [PARAGRAPH_BREAK, LINE_BREAK]) {
    const index = text.lastIndexOf(separator, hardEnd);
    if (index >= earliest) return index;
  }
  for (let index = hardEnd; index >= earliest; index -= 1) {
    if (isSpace(text, index)) return index;
  }
  return hardEnd;
}

/** Moves a start forward past the word it falls in so a chunk never starts mid-word; the caller skips the spaces. */
function snapToWordStart(text: string, from: number, limit: number): number {
  if (isSpace(text, from - 1)) return from;
  let index = from;
  while (index < limit && !isSpace(text, index)) index += 1;
  return index;
}

/**
 * Splits canonical text into overlapping chunks with offsets. Pure and deterministic. Prefers to
 * end a chunk at a paragraph, then a line, then a space; a single token longer than the limit is
 * cut hard. Whitespace at both ends of a chunk is trimmed out of the offsets.
 */
export function chunkText(canonicalText: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = skipSpaces(canonicalText, 0);

  while (start < canonicalText.length) {
    const hardEnd = Math.min(start + CHUNKING.MAX_CHARS, canonicalText.length);
    const end = hardEnd < canonicalText.length ? findBreak(canonicalText, start, hardEnd) : hardEnd;

    let trimmedEnd = end;
    while (trimmedEnd > start && isSpace(canonicalText, trimmedEnd - 1)) trimmedEnd -= 1;
    chunks.push({
      ordinal: chunks.length,
      text: canonicalText.slice(start, trimmedEnd),
      startOffset: start,
      endOffset: trimmedEnd,
    });

    if (end >= canonicalText.length) break;
    const overlapStart = end - CHUNKING.OVERLAP_CHARS;
    const next = overlapStart > start ? snapToWordStart(canonicalText, overlapStart, end) : end;
    start = skipSpaces(canonicalText, next);
  }

  return chunks;
}
