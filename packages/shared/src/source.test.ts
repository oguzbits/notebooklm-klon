import { describe, expect, it } from 'vitest';

import {
  EMBEDDING_DIMENSIONS,
  SOURCE_KIND,
  SOURCE_STATUS,
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
    expect(SourceKindSchema.safeParse('IMAGE').success).toBe(false);
  });

  it('fixes the embedding size at 768 dimensions', () => {
    expect(EMBEDDING_DIMENSIONS).toBe(768);
  });
});
