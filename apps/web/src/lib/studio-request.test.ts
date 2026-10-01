import { REPORT_FORMAT, STUDIO_DIFFICULTY, STUDIO_KIND, STUDIO_SIZE } from '@nlm/shared';
import { describe, expect, it } from 'vitest';

import { source } from '@/test/fixtures';

import { buildCreateBody, canCreate, type CreateDraft } from './studio-request';

const a = source({ id: 'a' });
const b = source({ id: 'b' });
const draft = (changes: Partial<CreateDraft> = {}): CreateDraft => ({
  kind: STUDIO_KIND.QUIZ,
  format: null,
  size: STUDIO_SIZE.DEFAULT,
  difficulty: STUDIO_DIFFICULTY.MEDIUM,
  chosen: new Set(['a', 'b']),
  focus: '',
  ...changes,
});

describe('canCreate', () => {
  it('needs at least one source', () => {
    expect(canCreate(draft({ chosen: new Set() }))).toBe(false);
    expect(canCreate(draft())).toBe(true);
  });

  it('needs a template for a report, and words for your own', () => {
    const report = { kind: STUDIO_KIND.REPORT };
    expect(canCreate(draft({ ...report, format: null }))).toBe(false);
    expect(canCreate(draft({ ...report, format: REPORT_FORMAT.BRIEFING }))).toBe(true);
    expect(canCreate(draft({ ...report, format: REPORT_FORMAT.CUSTOM, focus: '  ' }))).toBe(false);
    expect(canCreate(draft({ ...report, format: REPORT_FORMAT.CUSTOM, focus: 'Kurz' }))).toBe(true);
  });
});

describe('buildCreateBody', () => {
  it('is null as long as the choices are not enough', () => {
    expect(buildCreateBody(draft({ chosen: new Set() }), [a, b])).toBeNull();
  });

  it('sends no list of sources when all are chosen, and no empty topic', () => {
    expect(buildCreateBody(draft(), [a, b])).toEqual({
      kind: STUDIO_KIND.QUIZ,
      size: STUDIO_SIZE.DEFAULT,
      difficulty: STUDIO_DIFFICULTY.MEDIUM,
    });
  });

  it('sends the chosen sources in their order and the trimmed topic', () => {
    expect(buildCreateBody(draft({ chosen: new Set(['b']), focus: ' RAG ' }), [a, b])).toEqual({
      kind: STUDIO_KIND.QUIZ,
      size: STUDIO_SIZE.DEFAULT,
      difficulty: STUDIO_DIFFICULTY.MEDIUM,
      sourceIds: ['b'],
      focus: 'RAG',
    });
  });

  it('builds a report with its template and a mind map without size and difficulty', () => {
    expect(
      buildCreateBody(draft({ kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ }), [a, b])
    ).toEqual({ kind: STUDIO_KIND.REPORT, format: REPORT_FORMAT.FAQ });
    expect(buildCreateBody(draft({ kind: STUDIO_KIND.MINDMAP }), [a, b])).toEqual({
      kind: STUDIO_KIND.MINDMAP,
    });
  });
});
