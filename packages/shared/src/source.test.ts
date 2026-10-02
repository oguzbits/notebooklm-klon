import { describe, expect, it } from 'vitest';

import {
  EMBEDDING_DIMENSIONS,
  SOURCE_FAILURE,
  SOURCE_KIND,
  SOURCE_STATUS,
  SourceFailureSchema,
  SourceKindSchema,
  SourceStatusSchema,
} from './source';

describe('source contracts', () => {
  it('parses every status of the dictionary and nothing else', () => {
    for (const status of Object.values(SOURCE_STATUS)) {
      expect(SourceStatusSchema.parse(status)).toBe(status);
    }
    expect(SourceStatusSchema.safeParse('DONE').success).toBe(false);
  });

  it('parses every source kind of the dictionary and nothing else', () => {
    for (const kind of Object.values(SOURCE_KIND)) {
      expect(SourceKindSchema.parse(kind)).toBe(kind);
    }
    expect(SourceKindSchema.safeParse('AUDIO').success).toBe(false);
  });

  it('fixes the embedding size at 768 dimensions', () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });

  it('parses every failure code of the dictionary and nothing else', () => {
    for (const failure of Object.values(SOURCE_FAILURE)) {
      expect(SourceFailureSchema.parse(failure)).toBe(failure);
    }
    expect(SourceFailureSchema.safeParse('BROKEN').success).toBe(false);
  });
});
