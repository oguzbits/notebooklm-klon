import {
  type CreateStudioBody,
  REPORT_FORMAT,
  type ReportFormat,
  type SourceSummary,
  STUDIO_KIND,
  type StudioDifficulty,
  type StudioKind,
  type StudioSize,
} from '@nlm/shared';

/** What the reader has chosen in the dialog of a Studio tile. */
export interface CreateDraft {
  kind: StudioKind;
  /** Only a report has one; null as long as none was picked. */
  format: ReportFormat | null;
  size: StudioSize;
  difficulty: StudioDifficulty;
  chosen: ReadonlySet<string>;
  focus: string;
}

/** Whether the choices are enough to make the output: a source, and for a report its template (and its words if it is your own). */
export function canCreate(draft: CreateDraft): boolean {
  if (draft.chosen.size === 0) return false;
  if (draft.kind !== STUDIO_KIND.REPORT) return true;
  if (draft.format === null) return false;
  return draft.format !== REPORT_FORMAT.CUSTOM || draft.focus.trim() !== '';
}

/**
 * The request for the server, or null while the choices are not enough. Only a real choice is sent:
 * all sources are the usual case and need no list, and an empty topic needs no field.
 */
export function buildCreateBody(
  draft: CreateDraft,
  sources: readonly SourceSummary[]
): CreateStudioBody | null {
  if (!canCreate(draft)) return null;
  const { kind, format, size, difficulty } = draft;
  const focus = draft.focus.trim();
  const options = {
    ...(draft.chosen.size < sources.length && {
      sourceIds: sources.map((source) => source.id).filter((id) => draft.chosen.has(id)),
    }),
    ...(focus !== '' && { focus }),
  };
  switch (kind) {
    case STUDIO_KIND.REPORT:
      return format === null ? null : { kind, format, ...options };
    case STUDIO_KIND.MINDMAP:
      return { kind, ...options };
    default:
      return { kind, size, difficulty, ...options };
  }
}
