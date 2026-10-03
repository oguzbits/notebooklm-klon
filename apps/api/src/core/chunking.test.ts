import fc from 'fast-check';
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

  it('prefers a paragraph break over a later line break', () => {
    const text = `${'x'.repeat(800)}\n\n${'y'.repeat(198)}\n${words(300)}`;

    expect(chunkText(text)[0]?.text).toBe('x'.repeat(800));
  });

  it('prefers a line break over a later space', () => {
    const text = `${'x'.repeat(900)}\n${words(300)}`;

    expect(chunkText(text)[0]?.text).toBe('x'.repeat(900));
  });

  it('takes a break exactly in the middle of the window, but not one before it', () => {
    const middle = CHUNKING.MAX_CHARS / 2;
    const tail = 'y'.repeat(CHUNKING.MAX_CHARS * 2);

    for (const separator of ['\n', ' ']) {
      const atMiddle = chunkText(`${'x'.repeat(middle)}${separator}${tail}`);
      const beforeMiddle = chunkText(`${'x'.repeat(middle - 1)}${separator}${tail}`);

      expect(atMiddle[0]?.text).toBe('x'.repeat(middle));
      expect(beforeMiddle[0]?.text).toHaveLength(CHUNKING.MAX_CHARS);
    }
  });

  it('keeps text of exactly the size limit in one chunk and splits one character more', () => {
    const exact = `${'a '.repeat(CHUNKING.MAX_CHARS / 2 - 1)}ab`;
    const over = `${exact}c`;

    expect(exact).toHaveLength(CHUNKING.MAX_CHARS);
    expect(chunkText(exact).map((chunk) => chunk.text.length)).toEqual([CHUNKING.MAX_CHARS]);
    expect(chunkText(over)).toHaveLength(2);
    expect(chunkText('a'.repeat(CHUNKING.MAX_CHARS + 1)).map((chunk) => chunk.text.length)).toEqual(
      [CHUNKING.MAX_CHARS, 1]
    );
  });

  it('starts the next chunk exactly one overlap before the end when that is a word start', () => {
    const [first, second] = chunkText('ab '.repeat(2000));

    expect((first?.endOffset ?? 0) - (second?.startOffset ?? 0)).toBe(CHUNKING.OVERLAP_CHARS);
  });

  it('repeats about the configured overlap at the start of the next chunk', () => {
    const chunks = chunkText(words(1200));
    const longestWord = 'wort1199'.length;

    expect(chunks.length).toBeGreaterThan(3);
    chunks.slice(1).forEach((chunk, index) => {
      const overlap = (chunks[index]?.endOffset ?? 0) - chunk.startOffset;
      expect(overlap).toBeGreaterThanOrEqual(CHUNKING.OVERLAP_CHARS - longestWord - 1);
      expect(overlap).toBeLessThanOrEqual(CHUNKING.OVERLAP_CHARS);
    });
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

  describe('for any text', () => {
    const word = fc.stringMatching(/^[a-zäöü0-9|.,-]{1,30}$/);
    const spacing = fc.constantFrom(' ', ' ', ' ', '\n', '\n\n');
    const text = fc
      .array(fc.tuple(word, spacing), { minLength: 1, maxLength: 900 })
      .map((parts) => parts.map(([w, s]) => `${w}${s}`).join(''));

    it('points every chunk back into the text, within the size limit and in order', () => {
      fc.assert(
        fc.property(text, (canonical) => {
          const chunks = chunkText(canonical);

          chunks.forEach((chunk, index) => {
            expect(chunk.ordinal).toBe(index);
            expect(canonical.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
            expect(chunk.text.length).toBeLessThanOrEqual(CHUNKING.MAX_CHARS);
            expect(chunk.text).toBe(chunk.text.trim());
            expect(chunk.text).not.toBe('');
          });
          chunks.slice(1).forEach((chunk, index) => {
            expect(chunk.startOffset).toBeGreaterThan(chunks[index]?.startOffset ?? 0);
            expect(chunk.endOffset).toBeGreaterThan(chunks[index]?.endOffset ?? 0);
          });
        })
      );
    });

    it('leaves no character of the text out of every chunk', () => {
      fc.assert(
        fc.property(text, (canonical) => {
          const chunks = chunkText(canonical);
          const covered = new Set<number>();
          for (const chunk of chunks) {
            for (let index = chunk.startOffset; index < chunk.endOffset; index += 1) {
              covered.add(index);
            }
          }

          for (let index = 0; index < canonical.length; index += 1) {
            if (!/\s/.test(canonical.charAt(index))) expect(covered.has(index)).toBe(true);
          }
        })
      );
    });

    it('never starts or ends a chunk inside a word', () => {
      fc.assert(
        fc.property(text, (canonical) => {
          for (const chunk of chunkText(canonical)) {
            const before = canonical.charAt(chunk.startOffset - 1);
            const after = canonical.charAt(chunk.endOffset);
            expect(before === '' || /\s/.test(before)).toBe(true);
            expect(after === '' || /\s/.test(after)).toBe(true);
          }
        })
      );
    });
  });

  it('starts and ends every chunk of a table at a whole row, so no row is cut in two', () => {
    const row = fc
      .array(fc.stringMatching(/^[a-z0-9]{1,12}$/), { minLength: 1, maxLength: 12 })
      .map((cells) => `| ${cells.join(' | ')} |`);

    fc.assert(
      fc.property(fc.array(row, { minLength: 30, maxLength: 200 }), (rows) => {
        const chunks = chunkText(rows.join('\n'));

        for (const chunk of chunks) {
          const lines = chunk.text.split('\n');
          expect(rows).toContain(lines[0]);
          expect(rows).toContain(lines.at(-1));
        }
      })
    );
  });
});
