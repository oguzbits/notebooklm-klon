/**
 * Stand-ins for the model and the embedding, used by the offline server (Playwright, manual UI
 * checks). They cost no quota and give the same result every time. They are not meant to be good.
 */

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const MIN_WORD_CHARS = 3;
const PASSAGE = /\[(c\d+)\]\n([\s\S]*?)(?=\n\n\[c\d+\]\n|\n\nQuestion:|$)/g;
// A sentence ends at ".", "!" or "?" followed by a space, but not after an abbreviation like "Dr.".
const SENTENCE_END = /(?<!\b\p{L}{1,2}\.)(?<=[.!?])\s+/u;
const NO_ANSWER = 'In den ausgewählten Quellen steht dazu nichts.';
const MAX_PASSAGES_IN_ANSWER = 2;
const STREAM_PIECE_CHARS = 24;
const STREAM_PIECE_DELAY_MS = 25;

function hashWord(word: string): number {
  let hash = FNV_OFFSET;
  for (const char of word) {
    hash = Math.imul(hash ^ char.codePointAt(0)!, FNV_PRIME) >>> 0;
  }
  return hash;
}

/** A bag-of-words vector: each word adds one to a slot chosen by its hash. Unit length. */
export function hashEmbedding(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  const words = text.toLowerCase().match(/\p{L}+|\d+/gu) ?? [];
  for (const word of words) {
    if (word.length >= MIN_WORD_CHARS) {
      const slot = hashWord(word) % dimensions;
      vector[slot] = (vector[slot] ?? 0) + 1;
    }
  }
  const length = Math.hypot(...vector);
  if (length === 0) return vector.map((_, index) => (index === 0 ? 1 : 0));
  return vector.map((value) => value / length);
}

/**
 * An "answer" made of the first sentence of the best passages, as the JSON the chat expects. The
 * model reads the passages from the prompt like the real one, so the citation flow is real.
 */
export function extractiveAnswer(userMessage: string): string {
  const passages = [...userMessage.matchAll(PASSAGE)].slice(0, MAX_PASSAGES_IN_ANSWER);
  const statements =
    passages.length === 0
      ? [{ text: NO_ANSWER, chunkIds: [] }]
      : passages.map(([, label, text]) => ({
          text: (text ?? '').trim().split(SENTENCE_END)[0] ?? '',
          chunkIds: [label ?? ''],
        }));
  return JSON.stringify({ statements });
}

/** Hands the text out in small pieces with a short pause, so the UI shows real streaming. */
export async function* trickle(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += STREAM_PIECE_CHARS) {
    await new Promise((resolve) => setTimeout(resolve, STREAM_PIECE_DELAY_MS));
    yield text.slice(i, i + STREAM_PIECE_CHARS);
  }
}
