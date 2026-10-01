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
const FAKE_FOLLOW_UPS = ['Was steht noch in den Quellen?', 'Welche Einzelheiten gibt es dazu?'];
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
  return JSON.stringify({
    statements,
    followUps: passages.length === 0 ? [] : FAKE_FOLLOW_UPS,
  });
}

/** Hands the text out in small pieces with a short pause, so the UI shows real streaming. */
export async function* trickle(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += STREAM_PIECE_CHARS) {
    await new Promise((resolve) => setTimeout(resolve, STREAM_PIECE_DELAY_MS));
    yield text.slice(i, i + STREAM_PIECE_CHARS);
  }
}

const TITLE_LINE = /^Document title: (.*)\n\n/;
const MAX_TOPICS = 4;
const SUMMARY_SENTENCES = 2;
const EMPTY_SUMMARY = 'Dieses Dokument enthält keinen lesbaren Text.';

/** A stand-in for the overview: the first sentences as summary, the most frequent words as topics. */
export function fakeOverview(userMessage: string): string {
  const title = TITLE_LINE.exec(userMessage)?.[1] ?? 'dem Dokument';
  const text = userMessage.replace(TITLE_LINE, '').trim();
  const summary = text.split(SENTENCE_END).slice(0, SUMMARY_SENTENCES).join(' ') || EMPTY_SUMMARY;

  const counts = new Map<string, number>();
  for (const word of text.match(/\p{Lu}\p{L}{3,}/gu) ?? []) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const keyTopics = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOPICS)
    .map(([word]) => word);

  return JSON.stringify({
    summary,
    keyTopics,
    suggestedQuestions: [
      `Worum geht es in ${title}?`,
      `Was sind die wichtigsten Punkte in ${title}?`,
    ],
  });
}

const STUDIO_TITLE_WORDS = 3;

function firstWords(text: string, count: number): string {
  return text.split(/\s+/).slice(0, count).join(' ');
}

/**
 * A stand-in for the Studio: the first sentence of each passage as the content, cited with its
 * label. The kind is read from the schema the real model would get, like the real model does.
 */
export function fakeStudio(schema: Record<string, unknown>, userMessage: string): string {
  const passages = [...userMessage.matchAll(PASSAGE)].map(([, label, text]) => ({
    label: label ?? '',
    sentence: (text ?? '').trim().split(SENTENCE_END)[0] ?? '',
  }));
  const properties = Object.keys((schema.properties ?? {}) as Record<string, unknown>);
  const title = firstWords(passages[0]?.sentence ?? 'Zusammenfassung', STUDIO_TITLE_WORDS);

  if (properties.includes('cards')) {
    return JSON.stringify({
      title,
      cards: passages.map((p) => ({
        front: `Was steht hier: ${firstWords(p.sentence, STUDIO_TITLE_WORDS)} …?`,
        back: p.sentence,
        chunkIds: [p.label],
      })),
    });
  }
  if (properties.includes('questions')) {
    return JSON.stringify({
      title,
      questions: passages.map((p) => ({
        question: `Welche Aussage passt zur Quelle (${p.label})?`,
        options: [p.sentence, 'Das steht nirgends.', 'Keine der Antworten.', 'Das ist offen.'],
        correctIndex: 0,
        explanation: p.sentence,
        hint: `Lies die Stelle (${p.label}) noch einmal.`,
        rationales: [
          'Das steht so in der Quelle.',
          'Doch, es steht in der Quelle.',
          'Eine der Antworten stimmt.',
          'Die Quelle ist eindeutig.',
        ],
        chunkIds: [p.label],
      })),
    });
  }
  if (properties.includes('branches')) {
    return JSON.stringify({
      title,
      branches: passages.map((p) => ({
        label: firstWords(p.sentence, STUDIO_TITLE_WORDS),
        chunkIds: [p.label],
        children: [{ label: p.sentence, chunkIds: [p.label], children: [] }],
      })),
    });
  }
  return JSON.stringify({
    title,
    sections: passages.map((p) => ({
      heading: firstWords(p.sentence, STUDIO_TITLE_WORDS),
      statements: [{ text: p.sentence, chunkIds: [p.label] }],
    })),
  });
}
