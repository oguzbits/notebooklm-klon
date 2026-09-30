import { describe, expect, it } from 'vitest';

import { CHUNKING, chunkText } from './chunking';

const words = (count: number) => Array.from({ length: count }, (_, i) => `wort${i}`).join(' ');

describe('chunkText', () => {
  it('returns no chunks for empty or blank text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText(' \n\t ')).toEqual([]);
  });

  it('returns one chunk for short text and trims its offsets', () => {
    const text = '  Kurzer Text.  \n';

    expect(chunkText(text)).toEqual([
      { ordinal: 0, text: 'Kurzer Text.', startOffset: 2, endOffset: 14 },
    ]);
  });

  it('points every chunk back into the canonical text', () => {
    const text = words(1200);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
    }
  });

  it('numbers chunks from zero and keeps them within the size limit', () => {
    const chunks = chunkText(words(1200));

    expect(chunks.map((chunk) => chunk.ordinal)).toEqual(chunks.map((_, index) => index));
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(CHUNKING.MAX_CHARS);
    }
  });

  it('overlaps consecutive chunks and covers the whole text', () => {
    const text = words(1200);
    const chunks = chunkText(text);

    expect(chunks[0]?.startOffset).toBe(0);
    expect(chunks.at(-1)?.endOffset).toBe(text.length);
    chunks.slice(1).forEach((chunk, index) => {
      const previous = chunks[index];
      expect(chunk.startOffset).toBeLessThan(previous?.endOffset ?? 0);
      expect(chunk.startOffset).toBeGreaterThan(previous?.startOffset ?? 0);
    });
  });

  it('never cuts a word in half', () => {
    const text = words(1200);

    for (const chunk of chunkText(text)) {
      const before = text[chunk.startOffset - 1];
      const after = text[chunk.endOffset];
      expect(before === undefined || before === ' ').toBe(true);
      expect(after === undefined || after === ' ').toBe(true);
    }
  });

  it('prefers a paragraph break over a plain space', () => {
    const paragraph = words(150);
    const text = `${paragraph}\n\n${paragraph}`;
    const [first] = chunkText(text);

    expect(first?.text).toBe(paragraph);
  });

  it('cuts a word longer than the limit instead of looping forever', () => {
    const text = 'x'.repeat(CHUNKING.MAX_CHARS * 2 + 10);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const chunk of chunks) {
      expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
    }
    expect(chunks.at(-1)?.endOffset).toBe(text.length);
  });

  it('is deterministic', () => {
    const text = words(800);

    expect(chunkText(text)).toEqual(chunkText(text));
  });
});
