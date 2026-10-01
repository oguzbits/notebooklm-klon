import {
  type Note,
  NOTE_KIND,
  REPORT_FORMAT,
  type ReportFormat,
  STUDIO_KIND,
  type StudioKind,
  type StudioOutput,
} from '@nlm/shared';

import { withoutMarkers } from '@/lib/plain-text';

/** Names shown for the kinds of Studio output and the formats of a report. */
export const KIND_LABEL: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'Bericht',
  [STUDIO_KIND.FLASHCARDS]: 'Karteikarten',
  [STUDIO_KIND.QUIZ]: 'Quiz',
  [STUDIO_KIND.MINDMAP]: 'Mindmap',
  [STUDIO_KIND.DATA_TABLE]: 'Datentabelle',
};

/** What the button that closes the full view of an output says, like "Berichtsansicht schließen". */
export const CLOSE_VIEW_LABEL: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: 'Berichtsansicht schließen',
  [STUDIO_KIND.FLASHCARDS]: 'Karteikartenansicht schließen',
  [STUDIO_KIND.QUIZ]: 'Quizansicht schließen',
  [STUDIO_KIND.MINDMAP]: 'Mindmapansicht schließen',
  [STUDIO_KIND.DATA_TABLE]: 'Tabellenansicht schließen',
};

export const CLOSE_NOTE_LABEL = 'Notizansicht schließen';

/** The label on a tile of the Studio: the format in the plural, like the original. */
export const TILE_LABEL: Record<StudioKind, string> = {
  ...KIND_LABEL,
  [STUDIO_KIND.REPORT]: 'Berichte',
  [STUDIO_KIND.DATA_TABLE]: 'Datentabelle',
};

/** The templates of a report in the order of the dialog (the one the reader writes comes first). */
export const REPORT_TEMPLATES: readonly ReportFormat[] = [
  REPORT_FORMAT.CUSTOM,
  REPORT_FORMAT.BRIEFING,
  REPORT_FORMAT.STUDY_GUIDE,
  REPORT_FORMAT.BLOG,
  REPORT_FORMAT.FAQ,
];

export const FORMAT_LABEL: Record<ReportFormat, string> = {
  [REPORT_FORMAT.BRIEFING]: 'Überblick',
  [REPORT_FORMAT.FAQ]: 'Häufige Fragen',
  [REPORT_FORMAT.STUDY_GUIDE]: 'Lernplan',
  [REPORT_FORMAT.BLOG]: 'Blogpost',
  [REPORT_FORMAT.CUSTOM]: 'Eigenen Bericht erstellen',
};

/** What the row of a report in the list says about its template ("Briefing Doc" in the original). */
export const FORMAT_KIND: Record<ReportFormat, string> = {
  ...FORMAT_LABEL,
  [REPORT_FORMAT.CUSTOM]: 'Eigener Bericht',
};

/** One line under each template in the dialog of a report, worded like the original. */
export const FORMAT_DESCRIPTION: Record<ReportFormat, string> = {
  [REPORT_FORMAT.BRIEFING]: 'Übersicht über deine Quellen mit wichtigen Informationen und Zitaten',
  [REPORT_FORMAT.FAQ]: 'Die häufigsten Fragen, beantwortet aus den Quellen',
  [REPORT_FORMAT.STUDY_GUIDE]:
    'Quiz mit kurzen Antworten, vorgeschlagene Essay-Fragestellungen und Glossar wichtiger Begriffe',
  [REPORT_FORMAT.BLOG]:
    'Aufschlussreiche Kernpunkte, zusammengefasst in einem leicht verständlichen Artikel',
  [REPORT_FORMAT.CUSTOM]:
    'Berichte nach eigenen Vorstellungen erstellen und Angaben zu Aufbau, Stil, Ton und mehr machen',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * What a row of the list says before the time: for a report its template, then how many sources it
 * was made from ("Briefing Doc · 2 Quellen"). An output from before the sources were kept has no count.
 */
export function describeOutput(output: StudioOutput): string {
  const parts: string[] = [];
  if (output.kind === STUDIO_KIND.REPORT) parts.push(FORMAT_KIND[output.format]);
  if (output.request) parts.push(plural(output.request.sources.length, 'Quelle', 'Quellen'));
  return parts.join(' · ');
}

/** What a note of the reader is called until they name it, like in the original. */
export const NEW_NOTE_TITLE = 'Neue Notiz';

const dateFormat = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * What a note is called: the name the reader gave it. A note of the reader without one is "Neue
 * Notiz"; a saved answer without one is the start of its text.
 */
export function noteTitle(note: Note): string {
  if (note.title !== null) return note.title;
  if (note.kind === NOTE_KIND.WRITTEN) return NEW_NOTE_TITLE;
  const text = note.statements
    .map((statement) => withoutMarkers(statement.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text === '' ? 'Notiz' : text;
}

/** The name of the file a note becomes when it is made a source: Markdown for a note of the reader. */
export function noteFileName(note: Note): string {
  const safe = (name: string) => name.replace(/[\\/]/g, '-');
  if (note.kind === NOTE_KIND.WRITTEN) return `${safe(noteTitle(note))}.md`;
  return `${safe(note.title ?? `Notiz vom ${dateFormat.format(new Date(note.createdAt))}`)}.txt`;
}
