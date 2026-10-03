import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EvalDatasetSchema } from './dataset';
import { normalizeText } from './scorers';

const GOLDEN_PATH = fileURLToPath(new URL('./golden-questions.json', import.meta.url));
const TEXT_DIR = fileURLToPath(new URL('../../../../spikes/corpus/_text/', import.meta.url));

const dataset = EvalDatasetSchema.parse(JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')));

describe('golden questions', () => {
  // The corpus is git-ignored. Build it with spikes/build-corpus.py, then
  // spikes/extract-corpus-text.py. Without the extracted text the anchors cannot be verified.
  describe.skipIf(!existsSync(TEXT_DIR))('anchors against the extracted source text', () => {
    const anchors = dataset.flatMap((question) =>
      question.expectedAnchors.map((anchor) => ({ id: question.id, ...anchor }))
    );

    it.each(anchors)('$id: anchor is literal text of $sourceFile', ({ sourceFile, text }) => {
      const source = normalizeText(readFileSync(`${TEXT_DIR}${sourceFile}.txt`, 'utf8'));

      expect(source).toContain(normalizeText(text));
    });
  });
});
