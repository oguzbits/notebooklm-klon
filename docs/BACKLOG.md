# Stand und Backlog

Aus dem Gesamtreview vom 2026-10-02 (vier lesende Prüfungen und ein Journey-Lauf auf der Live-Seite).
Die erledigten Punkte stehen mit ihrer Begründung in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md) und in der
Git-Historie; hier steht nur, was offen ist oder bewusst nicht gebaut wird.

## Stand

Alle Befunde der Stufen „Hoch“ (H1 bis H7) sind behoben. Von den mittleren sind M1, M2, M3, M5 und M8 bis M17 erledigt, M7 bis auf den Tarif-Hinweis;
offen sind M4, M6 (Titellänge, Zip-Bombe) und M10. Die Funktionslücken aus dem Review
(neu einlesen, Export, Konto löschen, Stopp-Button) und die Dateitypen PDF-Link, Bilder, Audio, PPTX und YouTube sind gebaut.

Gates auf dem letzten Stand: `pnpm check`, `pnpm test` (1179 Tests), `pnpm test:db` und `pnpm e2e` (24 Tests) grün.
Nicht geprüft: Screenreader auf echten Geräten, echte Mobilgeräte, Semgrep lokal (läuft im CI).

## Entscheidungen des Nutzers

- Datenschutzerklärung und Impressum: nicht nötig.
- Kopie des Backups auf einen anderen Server: nicht nötig. Dump vor jedem Deploy und Restore-Probe (`deploy/restore-check.sh`) gibt es.
- Hinweis zum Gemini-Tarif im Upload-Dialog: zurückgestellt, solange die Seite eine Demo ist. Das README warnt davor, sensible Dokumente hochzuladen.

## Offen

| #   | Thema                 | Befund                                                                                                                                                                                                                                      | Fix                                                                                                   |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| M4  | HNSW-Index mit Filter | Weder `hnsw.iterative_scan` noch `ef_search` sind gesetzt. Bei vielen Nutzern kann der nachgelagerte SQL-Filter zu wenige Treffer liefern. Heute bei kleinen Mengen ohne Folge.                                                             | `SET LOCAL hnsw.iterative_scan = relaxed_order` pro Abfrage, vorher und nachher mit `EXPLAIN` messen. |
| M6  | Upload-Prüfung        | `title: file.name` ohne Längenbegrenzung (`routes/sources.ts`, `ingestion/local-import.ts`); kein Schutz gegen Zip-Bomben in mammoth.                                                                                                       | Titel kürzen, entpackte Größe begrenzen.                                                              |
| M10 | CI und Server-Härtung | Dependency-Audit (Produktion, ab `high`) läuft im CI; kein Trivy. `pnpm audit` meldet eine moderate Lücke (esbuild über drizzle-kit, nur Dev-Server). Kein fail2ban, `deploy` sitzt in der Docker-Gruppe. sslip.io teilt Zertifikatslimits. | Audit im CI, fail2ban, eigene Domain.                                                                 |

Kleinigkeiten:

- `lib/download.ts`: `revokeObjectURL` direkt nach `click()` kann Downloads abbrechen.
- `use-sources.ts`: Abfrage alle 2 s ohne Backoff, solange eine Quelle arbeitet.
- Hash über rohe HTML-Bytes: dynamische Seiten werden nie als Duplikat erkannt.
- „Prompt“ ist ein Fachbegriff für Nutzer (`studio/prompt-chip.tsx`) und verletzt Regel 10 aus [AGENTS.md](../AGENTS.md), wenn er sichtbar ist.
- Rohe Controls statt shadcn an einigen Stellen (`quiz-option.tsx`, `studio-tiles.tsx`, `library-row.tsx`), nicht einzeln beurteilt.
- `pdf-lib` hat seit November 2021 kein Release mehr, funktioniert aber.

## Messung steht aus

Das Gewicht 0,5 der Volltextsuche in der Hybridsuche ist nur durch den Sprachunterschied begründet, nicht durch eine Messung:
auf den 18 Spike-Fragen ist Hybrid nicht besser als reine Vektorsuche (siehe [SPIKE-ERGEBNISSE.md](SPIKE-ERGEBNISSE.md)).
Mit mehr Fragen erneut prüfen (`pnpm eval:live`).

## Später

| Thema                     | Anmerkung                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| XLSX und CSV              | Der Studio-Kontext (`STUDIO_MAX_CHARS` 120 000) wird gleichmäßig auf die Quellen verteilt, der Anfang jeder Quelle bleibt. Große Tabellen würden abgeschnitten, vorher klären. |
| HTML-Datei                | Geringer Nutzen.                                                                                                                                                               |
| Tastaturkürzel            | Nicht gebaut.                                                                                                                                                                  |
| Suche über alle Notebooks | Nicht gebaut.                                                                                                                                                                  |

Bewusst nicht: EPUB, Google Docs und Slides (siehe [DESIGN-ABGLEICH.md](DESIGN-ABGLEICH.md)), Teilen, Audio- und Videoübersicht,
Deep Research, Drive, Daumen-Bewertung, PDF-Export, Rückgängig beim Löschen (jedes Löschen fragt vorher, siehe ENTSCHEIDUNGEN).

## Nicht gegen die aktuelle Doku geprüft

Hetzner-Preise und -Ausstattung, Fork-PR-Einstellungen auf GitHub, `EXPLAIN` der Vektorsuche, die Quellentypen von NotebookLM
selbst (Regel 12 aus AGENTS.md: vor einer Entscheidung dort nachsehen).
