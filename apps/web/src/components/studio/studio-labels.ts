import {
  type Note,
  REPORT_FORMAT,
  type ReportFormat,
  STUDIO_KIND,
  type StudioKind,
  type StudioOutput,
} from '@nlm/shared';

/** Names shown for the kinds of Studio output and the formats of a report. */
export const KIND_LABEL: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'Bericht',
  [STUDIO_KIND.FLASHCARDS]: 'Karteikarten',
  [STUDIO_KIND.QUIZ]: 'Quiz',
  [STUDIO_KIND.MINDMAP]: 'Mindmap',
};

/** The label on a tile of the Studio: the format in the plural, like the original. */
export const TILE_LABEL: Record<StudioKind, string> = {
  ...KIND_LABEL,
  [STUDIO_KIND.REPORT]: 'Berichte',
};

export const FORMAT_LABEL: Record<ReportFormat, string> = {
  [REPORT_FORMAT.BRIEFING]: 'Briefing',
  [REPORT_FORMAT.FAQ]: 'Häufige Fragen',
  [REPORT_FORMAT.STUDY_GUIDE]: 'Lernleitfaden',
};

/** One line under each template in the dialog of a report. */
export const FORMAT_DESCRIPTION: Record<ReportFormat, string> = {
  [REPORT_FORMAT.BRIEFING]: 'Überblick über die Quellen mit den wichtigsten Informationen',
  [REPORT_FORMAT.FAQ]: 'Die häufigsten Fragen, beantwortet aus den Quellen',
  [REPORT_FORMAT.STUDY_GUIDE]: 'Kernbegriffe und Fragen, um den Stoff zu lernen',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The line under the title of an output in the list. */
export function describeOutput(output: StudioOutput): string {
  switch (output.kind) {
    case STUDIO_KIND.REPORT:
      return `Bericht · ${FORMAT_LABEL[output.format]}`;
    case STUDIO_KIND.FLASHCARDS:
      return `Karteikarten · ${plural(output.content.cards.length, 'Karte', 'Karten')}`;
    case STUDIO_KIND.QUIZ:
      return `Quiz · ${plural(output.content.questions.length, 'Frage', 'Fragen')}`;
    case STUDIO_KIND.MINDMAP:
      return `Mindmap · ${plural(output.content.branches.length, 'Ast', 'Äste')}`;
  }
}

/** What a note is called in the list: the start of its text, since a note has no title of its own. */
export function noteTitle(note: Note): string {
  const text = note.statements
    .map((statement) => statement.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text === '' ? 'Notiz' : text;
}
