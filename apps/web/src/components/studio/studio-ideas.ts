import { STUDIO_KIND, type StudioKind } from '@nlm/shared';

import { tr } from '@/lib/i18n';

/** Ideas shown in the empty topic field, like the original; they are only examples. */
export const IDEAS: Record<StudioKind, readonly string[]> = {
  [STUDIO_KIND.REPORT]: [
    tr(
      'Der Bericht richtet sich an Leser ohne Vorwissen (z. B. „für eine Besprechung am Montag“)',
      'The report is written for readers with no background (e.g. “for a meeting on Monday”)'
    ),
    tr(
      'Der Bericht stellt die Ergebnisse in einer Tabelle dar',
      'The report presents the results in a table'
    ),
    tr(
      'Der Bericht hat einen sachlichen Ton und höchstens eine Seite',
      'The report has a factual tone and is at most one page long'
    ),
  ],
  [STUDIO_KIND.FLASHCARDS]: [
    tr(
      'Die Lernkarten müssen auf eine bestimmte Quelle beschränkt sein (z. B. „der Artikel über Italien“)',
      'The flashcards must be limited to one specific source (e.g. “the article about Italy”)'
    ),
    tr(
      'Die Lernkarten müssen sich auf ein konkretes Thema beziehen (z. B. „Newtons zweites Gesetz“)',
      'The flashcards must cover a specific topic (e.g. “Newton’s second law”)'
    ),
    tr(
      'Der Text auf der Vorderseite der Karten muss kurz sein (1 bis 5 Wörter), damit er sich leicht merken lässt',
      'The text on the front of the cards must be short (1 to 5 words) so it is easy to remember'
    ),
  ],
  [STUDIO_KIND.QUIZ]: [
    tr(
      'Erstelle mir ein Quiz, mit dem ich für meinen Geschichtstest über das Alte Ägypten lernen kann',
      'Create a quiz I can use to study for my history test on Ancient Egypt'
    ),
    tr(
      'Das Quiz muss auf eine bestimmte Quelle beschränkt sein (z. B. „der Artikel über Italien“)',
      'The quiz must be limited to one specific source (e.g. “the article about Italy”)'
    ),
    tr(
      'Das Quiz muss sich ausschließlich auf die wichtigsten Konzepte der Physik konzentrieren',
      'The quiz must focus only on the most important concepts of physics'
    ),
  ],
  [STUDIO_KIND.MINDMAP]: [
    tr(
      'Die Mindmap muss auf eine bestimmte Quelle beschränkt sein, z. B. „der Artikel über Italien“',
      'The mind map must be limited to one specific source, e.g. “the article about Italy”'
    ),
    tr(
      'Die Mindmap muss sich ausschließlich auf die wichtigsten Konzepte der Quantenphysik konzentrieren',
      'The mind map must focus only on the most important concepts of quantum physics'
    ),
    tr(
      'Eine Mindmap, die mir dabei hilft, mir die Ursachen des Ersten Weltkriegs zu merken',
      'A mind map that helps me remember the causes of the First World War'
    ),
  ],
  [STUDIO_KIND.DATA_TABLE]: [
    tr(
      'Die Tabelle vergleicht die Quellen nach Fristen, Kosten und Zuständigkeiten',
      'The table compares the sources by deadlines, costs and responsibilities'
    ),
    tr(
      'Die Tabelle muss auf eine bestimmte Quelle beschränkt sein (z. B. „der Artikel über Italien“)',
      'The table must be limited to one specific source (e.g. “the article about Italy”)'
    ),
    tr(
      'Eine Tabelle mit den wichtigsten Personen, ihren Aufgaben und seit wann sie dabei sind',
      'A table of the key people, their roles and how long they have been involved'
    ),
  ],
};

export const CUSTOM_IDEAS = [
  tr(
    'Ein Brief an die Projektleitung, der die Ergebnisse in drei Absätzen zusammenfasst',
    'A letter to the project lead that summarises the results in three paragraphs'
  ),
  tr(
    'Eine Checkliste mit allen Fristen und Zuständigkeiten aus den Quellen',
    'A checklist of all deadlines and responsibilities from the sources'
  ),
  tr(
    'Ein Vergleich der Quellen in einer Tabelle, danach eine kurze Empfehlung',
    'A comparison of the sources in a table, followed by a short recommendation'
  ),
];
