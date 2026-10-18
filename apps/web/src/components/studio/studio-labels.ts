import {
  type Note,
  NOTE_KIND,
  REPORT_FORMAT,
  type ReportFormat,
  STUDIO_KIND,
  type StudioKind,
  type StudioOutput,
} from '@nlm/shared';

import { INTL_LOCALE, locale, tr } from '@/lib/i18n';
import { withoutMarkers } from '@/lib/plain-text';
import { sourcesLabel } from '@/lib/sources-label';

/** Names shown for the kinds of Studio output and the formats of a report. */
export const KIND_LABEL: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: tr('Bericht', 'Report'),
  [STUDIO_KIND.FLASHCARDS]: tr('Karteikarten', 'Flashcards'),
  [STUDIO_KIND.QUIZ]: tr('Quiz', 'Quiz'),
  [STUDIO_KIND.MINDMAP]: tr('Mindmap', 'Mind Map'),
  [STUDIO_KIND.DATA_TABLE]: tr('Datentabelle', 'Data table'),
};

/** What the button that closes the full view of an output says, like "Close report view". */
export const CLOSE_VIEW_LABEL: Record<StudioKind, string> = {
  [STUDIO_KIND.REPORT]: tr('Berichtsansicht schließen', 'Close report view'),
  [STUDIO_KIND.FLASHCARDS]: tr('Karteikartenansicht schließen', 'Close flashcards view'),
  [STUDIO_KIND.QUIZ]: tr('Quizansicht schließen', 'Close quiz view'),
  [STUDIO_KIND.MINDMAP]: tr('Mindmapansicht schließen', 'Close mind map view'),
  [STUDIO_KIND.DATA_TABLE]: tr('Tabellenansicht schließen', 'Close table view'),
};

export const CLOSE_NOTE_LABEL = tr('Notizansicht schließen', 'Close note view');

/** The label on a tile of the Studio: the format in the plural, like the original. */
export const TILE_LABEL: Record<StudioKind, string> = {
  ...KIND_LABEL,
  [STUDIO_KIND.REPORT]: tr('Berichte', 'Reports'),
  [STUDIO_KIND.DATA_TABLE]: tr('Datentabelle', 'Data table'),
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
  [REPORT_FORMAT.BRIEFING]: tr('Überblick', 'Briefing doc'),
  [REPORT_FORMAT.FAQ]: tr('Häufige Fragen', 'Frequently asked questions'),
  [REPORT_FORMAT.STUDY_GUIDE]: tr('Lernplan', 'Study guide'),
  [REPORT_FORMAT.BLOG]: tr('Blogpost', 'Blog post'),
  [REPORT_FORMAT.CUSTOM]: tr('Eigenen Bericht erstellen', 'Create your own report'),
};

/** What the row of a report in the list says about its template ("Briefing Doc" in the original). */
export const FORMAT_KIND: Record<ReportFormat, string> = {
  ...FORMAT_LABEL,
  [REPORT_FORMAT.CUSTOM]: tr('Eigener Bericht', 'Custom report'),
};

/** One line under each template in the dialog of a report, worded like the original. */
export const FORMAT_DESCRIPTION: Record<ReportFormat, string> = {
  [REPORT_FORMAT.BRIEFING]: tr(
    'Übersicht über deine Quellen mit wichtigen Informationen und Zitaten',
    'An overview of your sources with key insights and quotes'
  ),
  [REPORT_FORMAT.FAQ]: tr(
    'Die häufigsten Fragen, beantwortet aus den Quellen',
    'The most common questions, answered from the sources'
  ),
  [REPORT_FORMAT.STUDY_GUIDE]: tr(
    'Quiz mit kurzen Antworten, vorgeschlagene Essay-Fragestellungen und Glossar wichtiger Begriffe',
    'Short-answer quiz, suggested essay questions and a glossary of key terms'
  ),
  [REPORT_FORMAT.BLOG]: tr(
    'Aufschlussreiche Kernpunkte, zusammengefasst in einem leicht verständlichen Artikel',
    'Insightful takeaways, condensed into an easy-to-read article'
  ),
  [REPORT_FORMAT.CUSTOM]: tr(
    'Berichte nach eigenen Vorstellungen erstellen und Angaben zu Aufbau, Stil, Ton und mehr machen',
    'Create a report your way and specify structure, style, tone and more'
  ),
};

/**
 * What a row of the list says before the time: for a report its template, then how many sources it
 * was made from ("Briefing doc · 2 sources"). An output from before the sources were kept has no count.
 */
export function describeOutput(output: StudioOutput): string {
  const parts: string[] = [];
  if (output.kind === STUDIO_KIND.REPORT) parts.push(FORMAT_KIND[output.format]);
  if (output.request) parts.push(sourcesLabel(output.request.sources.length));
  return parts.join(' · ');
}

/** What a note of the reader is called until they name it, like in the original. */
export const NEW_NOTE_TITLE = tr('Neue Notiz', 'New note');

const dateFormat = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * What a note is called: the name the reader gave it. A note of the reader without one is "New
 * note"; a saved answer without one is the start of its text.
 */
export function noteTitle(note: Note): string {
  if (note.title !== null) return note.title;
  if (note.kind === NOTE_KIND.WRITTEN) return NEW_NOTE_TITLE;
  const text = note.statements
    .map((statement) => withoutMarkers(statement.text))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text === '' ? tr('Notiz', 'Note') : text;
}

/** The name of the file a note becomes when it is made a source: Markdown for a note of the reader. */
export function noteFileName(note: Note): string {
  const safe = (name: string) => name.replace(/[\\/]/g, '-');
  if (note.kind === NOTE_KIND.WRITTEN) return `${safe(noteTitle(note))}.md`;
  return `${safe(
    note.title ??
      tr(
        `Notiz vom ${dateFormat.format(new Date(note.createdAt))}`,
        `Note from ${dateFormat.format(new Date(note.createdAt))}`
      )
  )}.txt`;
}
