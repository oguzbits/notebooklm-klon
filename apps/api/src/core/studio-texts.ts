import { LOCALE, REPORT_FORMAT, STUDIO_DIFFICULTY, STUDIO_KIND, STUDIO_SIZE } from '@nlm/shared';

/** What the reader sees as the request behind an output, per interface language. */
export const STUDIO_TEXTS = {
  [LOCALE.DE]: {
    size: {
      [STUDIO_SIZE.FEWER]: 'Weniger',
      [STUDIO_SIZE.DEFAULT]: 'Standard',
      [STUDIO_SIZE.MORE]: 'Mehr',
    },
    difficulty: {
      [STUDIO_DIFFICULTY.EASY]: 'Einfach',
      [STUDIO_DIFFICULTY.MEDIUM]: 'Mittel',
      [STUDIO_DIFFICULTY.HARD]: 'Schwer',
    },
    report: {
      [REPORT_FORMAT.BRIEFING]:
        'Erstelle ein ausführliches Briefing-Dokument, das die wichtigsten Themen, Belege und ' +
        'Schlussfolgerungen der Quellen zusammenfasst. Beginne mit einer kurzen Zusammenfassung, ' +
        'gliedere den Text logisch mit Überschriften und halte den Ton sachlich und prägnant.',
      [REPORT_FORMAT.FAQ]:
        'Erstelle einen Katalog häufiger Fragen zu den Quellen. Jede Überschrift ist eine Frage, die ' +
        'ein Leser stellen würde, und der Text darunter beantwortet sie aus den Quellen.',
      [REPORT_FORMAT.STUDY_GUIDE]:
        'Erstelle einen Lernplan mit Fragen und kurzen Antworten, vorgeschlagenen Essay-Fragestellungen ' +
        'und einem Glossar der wichtigsten Begriffe.',
      [REPORT_FORMAT.BLOG]:
        'Schreibe einen leicht verständlichen Blogpost, der die Kernpunkte der Quellen zusammenfasst.',
    },
    shape: {
      [STUDIO_KIND.MINDMAP]: 'Erstelle eine Mindmap, die die Quellen übersichtlich gliedert.',
      [STUDIO_KIND.DATA_TABLE]:
        'Erstelle eine Tabelle, die die wichtigsten Angaben der Quellen vergleichbar nebeneinanderstellt.',
    },
    focus: 'Schwerpunkt',
    topic: 'Thema',
    flashcards: 'Erstelle Karteikarten zu den Quellen.',
    quiz: 'Erstelle ein Quiz mit Multiple-Choice-Fragen zu den Quellen.',
    scope: 'Umfang',
    level: 'Schwierigkeit',
  },
  [LOCALE.EN]: {
    size: {
      [STUDIO_SIZE.FEWER]: 'Fewer',
      [STUDIO_SIZE.DEFAULT]: 'Default',
      [STUDIO_SIZE.MORE]: 'More',
    },
    difficulty: {
      [STUDIO_DIFFICULTY.EASY]: 'Easy',
      [STUDIO_DIFFICULTY.MEDIUM]: 'Medium',
      [STUDIO_DIFFICULTY.HARD]: 'Hard',
    },
    report: {
      [REPORT_FORMAT.BRIEFING]:
        'Create a detailed briefing document that sums up the main topics, evidence and ' +
        'conclusions of the sources. Start with a short summary, structure the text logically ' +
        'with headings and keep the tone factual and concise.',
      [REPORT_FORMAT.FAQ]:
        'Create a catalog of frequently asked questions about the sources. Each heading is a ' +
        'question a reader would ask, and the text below answers it from the sources.',
      [REPORT_FORMAT.STUDY_GUIDE]:
        'Create a study guide with questions and short answers, suggested essay questions and ' +
        'a glossary of the key terms.',
      [REPORT_FORMAT.BLOG]:
        'Write an easy-to-read blog post that sums up the key points of the sources.',
    },
    shape: {
      [STUDIO_KIND.MINDMAP]: 'Create a mind map that gives the sources a clear structure.',
      [STUDIO_KIND.DATA_TABLE]:
        'Create a table that sets the key facts of the sources side by side for comparison.',
    },
    focus: 'Focus',
    topic: 'Topic',
    flashcards: 'Create flashcards about the sources.',
    quiz: 'Create a multiple-choice quiz about the sources.',
    scope: 'Size',
    level: 'Difficulty',
  },
} as const;
