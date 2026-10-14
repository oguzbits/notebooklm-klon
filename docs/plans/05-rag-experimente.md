# Plan 5: RAG-Experimente

Voraussetzung: [Plan 3](03-eval.md) (Eval mit Baseline). Ein Experiment je Durchlauf, eine Variable, Gewinner nur über der Schwankung.

## Ist (im Code belegt)

- Hybrid: pgvector und Volltext (`simple`, ohne Wortstamm), RRF k=60, `TEXT_WEIGHT=0.5`, 20 Kandidaten je Suche, 12 Passagen ans Modell (`CHAT_CONTEXT_CHUNKS`).
- Chunks 1500/200 Zeichen. Einbettung gemini-embedding-2 mit 768 Dimensionen, `title: none`.
- Anfrage wird per Modell ins Deutsche und Englische übersetzt, dazu Teilfragen.
- HNSW ohne `iterative_scan` und `ef_search` (Backlog M4).

## Experimente (Reihenfolge nach erwartetem Nutzen)

| Nr. | Frage                                                     | Messung                                                                   |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| E1  | Ganze Quellen statt Suche, wenn sie in den Kontext passen | Treue und Vollständigkeit gegen Kosten und Dauer; Kleine Notebooks zuerst |
| E2  | Volltext mit deutschem Wortstamm statt `simple`           | Recall@k auf deutschen Fragen                                             |
| E3  | Chunkgröße 800, 1500, 2500 bei gleichem Überlapp-Anteil   | Recall@k, MRR, Antwortqualität                                            |
| E4  | Anzahl Passagen 6, 12, 20                                 | Treue gegen Verwässerung, Tokenkosten                                     |
| E5  | Titel der Quelle in den Einbettungstext                   | Recall@k bei Fragen, die Quellen unterscheiden                            |
| E6  | Neuordnung der Treffer (Reranker) auf den 20 Kandidaten   | MRR, Kosten; nur wenn E1 bis E5 nicht reichen                             |
| E7  | `hnsw.iterative_scan` und `ef_search` (M4)                | Trefferzahl bei gefilterter Suche mit vielen Nutzern (DB-Test)            |

## Regeln

- Jede Änderung der Einbettung oder Aufteilung braucht eine Migration der vorhandenen Chunks (Neu-Einbettung); Kosten vorab beziffern und mit dir abstimmen.
- Konfigurationswerte nur in `apps/api/src/config`.
- Ergebnis je Experiment als Tabelle in `docs/` (Maße, n, Datum, Modell-ID), Entscheidung im Commit-Text.

## Testfälle (für Änderungen, die gebaut werden)

- Suche filtert weiter in SQL nach `userId`, `notebookId`, `sourceIds` (bestehende DB-Tests laufen unverändert).
- E7: Mit 10 Nutzern und einem Filter auf einen Nutzer liefert die Suche die verlangte Zahl Treffer.

## Welcher Test wird rot

- E7: `iterative_scan` wieder ausschalten: Test „verlangte Zahl Treffer“.
