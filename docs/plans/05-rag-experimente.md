# Plan 5: RAG-Experimente

Stand: 2026-10-15. Nicht begonnen als Messreihe, bis ein schwererer Fragensatz existiert.

Voraussetzung ist [Plan 3](03-eval.md): Baseline und eine Menge, die Verbesserungen zeigen kann. Die heutige Menge steht bei 100 % und kann es nicht. Ein Experiment je Durchlauf, eine Variable,
Gewinner nur über der Schwankung; Ergebnis als Tabelle in `docs/` (Maße, n, Datum, Modell-ID), Entscheidung im Commit-Text.

## Ist

- Hybrid: pgvector und Volltext (`simple`, ohne Wortstamm), RRF k=60, `TEXT_WEIGHT=0.5`, 20 Kandidaten je Suche, 12 Passagen (`CHAT_CONTEXT_CHUNKS`). Chunks 1500/200 Zeichen an Zeilengrenzen.
- Einbettung gemini-embedding-2 mit 768 Dimensionen. Die Frage wird ins Deutsche und Englische übersetzt, dazu Teilfragen.
- Gebaut: Suche in beiden Sprachen und Teilfragen (`c5962c0`, `554e974`), Chunking an Zeilengrenzen (`a04bb00`).

## Experimente (Reihenfolge nach erwartetem Nutzen)

| Nr. | Frage                                                     | Messung                                                |
| --- | --------------------------------------------------------- | ------------------------------------------------------ |
| E1  | Ganze Quellen statt Suche, wenn sie in den Kontext passen | Treue und Vollständigkeit gegen Kosten und Dauer       |
| E2  | Volltext mit deutschem Wortstamm statt `simple`           | Recall@k auf deutschen Fragen (braucht Migration)      |
| E3  | Chunkgröße 800, 1500, 2500                                | Recall@k, MRR, Antwortqualität (braucht Neu-Einbetten) |
| E4  | Anzahl Passagen 6, 12, 20                                 | Treue gegen Verwässerung, Tokenkosten                  |
| E5  | Titel der Quelle in den Einbettungstext                   | Recall@k bei Fragen, die Quellen unterscheiden         |
| E6  | Neuordnung (Reranker) der 20 Kandidaten                   | MRR, Kosten; nur wenn E1 bis E5 nicht reichen          |

E7 (`hnsw.iterative_scan`, Backlog M4) entfällt: Die Suche nutzt den Index nicht, siehe [BACKLOG.md](../BACKLOG.md).

Regeln: Jede Änderung der Einbettung oder Aufteilung braucht Neu-Einbettung; Kosten vorab beziffern und mit dem Nutzer abstimmen. Konfigurationswerte nur in `apps/api/src/config`. Bestehende DB-Tests
(Filter nach `userId`, `notebookId`, `sourceIds`) laufen unverändert; der Prompt behält Zitatschema und Abwehr von Anweisungen im Quelltext.
