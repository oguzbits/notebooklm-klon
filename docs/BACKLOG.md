# Stand und Backlog

Aus dem Gesamtreview vom 2026-10-02 (vier lesende Prüfungen und ein Journey-Lauf auf der Live-Seite).
Die erledigten Punkte stehen in der
Git-Historie; hier steht nur, was offen ist oder bewusst nicht gebaut wird.

## Stand

Alle Befunde der Stufen „Hoch“ (H1 bis H7) sind behoben. Von den mittleren sind M1, M2, M3, M5 und M8 bis M17 erledigt, M6 (Titel auf 200 Zeichen gekürzt, DOCX und PPTX auf 100 MB entpackt begrenzt), M7 bis auf den Tarif-Hinweis;
offen ist M10; M4 trifft nicht zu (siehe unten). Die Funktionslücken aus dem Review
(neu einlesen, Export, Konto löschen, Stopp-Button) und die Dateitypen PDF-Link, Bilder, Audio, PPTX und YouTube sind gebaut.

Gates auf dem letzten Stand: `pnpm check`, `pnpm test`, `pnpm test:db` und `pnpm e2e` grün.
Nicht geprüft: Screenreader auf echten Geräten, echte Mobilgeräte, Semgrep lokal (läuft im CI).

## Entscheidungen des Nutzers

- Datenschutzerklärung und Impressum: nicht nötig.
- Kopie des Backups auf einen anderen Server: nicht nötig. Dump vor jedem Deploy und Restore-Probe (`deploy/restore-check.sh`) gibt es.
- Hinweis zum Gemini-Tarif im Upload-Dialog: zurückgestellt, solange die Seite eine Demo ist. Das README warnt davor, sensible Dokumente hochzuladen.

## Offen

| #   | Thema                 | Befund                                                                                                                                                                                                                                      | Fix                                   |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| M10 | CI und Server-Härtung | Dependency-Audit (Produktion, ab `high`) läuft im CI; kein Trivy. `pnpm audit` meldet eine moderate Lücke (esbuild über drizzle-kit, nur Dev-Server). Kein fail2ban, `deploy` sitzt in der Docker-Gruppe. sslip.io teilt Zertifikatslimits. | Audit im CI, fail2ban, eigene Domain. |

M4 (HNSW-Index mit Filter) trifft nicht zu: Die Suche ordnet nach Abstand über die CTE `scoped`, die über Verbindungen auf Nutzer, Notizbuch und Quellen gefiltert ist ([db/retrieval.ts](../apps/api/src/db/retrieval.ts)). Der HNSW-Index kann darüber nicht angewandt werden, der Scan ist exakt und verliert keine Treffer an einen nachgelagerten Filter. Aus dem Aufbau der Abfrage geschlossen, nicht mit `EXPLAIN` gemessen. Neu bewerten, wenn die Suche je auf den Index ausgerichtet wird.

Kleinigkeiten:

- `use-sources.ts`: Abfrage alle 2 s ohne Backoff, solange eine Quelle arbeitet. Bewusst gelassen: eine kurze, billige Abfrage während weniger Minuten.
- Hash über rohe HTML-Bytes: dynamische Seiten werden nie als Duplikat erkannt.
- Rohe Controls statt shadcn an einigen Stellen (`quiz-option.tsx`, `studio-tiles.tsx`, `library-row.tsx`), nicht einzeln beurteilt.
- `pdf-lib` hat seit November 2021 kein Release mehr, funktioniert aber.

## Messung steht aus

Das Gewicht 0,5 der Volltextsuche in der Hybridsuche ist nur durch den Sprachunterschied begründet, nicht durch eine Messung:
auf den 18 Spike-Fragen ist Hybrid nicht besser als reine Vektorsuche (siehe [SPIKE-ERGEBNISSE.md](SPIKE-ERGEBNISSE.md)).
Mit mehr Fragen erneut prüfen (`pnpm eval:live`).

## Später

| Thema                     | Anmerkung                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLSX und CSV              | Der Studio-Kontext (`STUDIO_MAX_CHARS` 120 000) wird gleichmäßig auf die Quellen verteilt, der Anfang jeder Quelle bleibt. Große Tabellen würden abgeschnitten, vorher klären.          |
| HTML-Datei                | Geringer Nutzen.                                                                                                                                                                        |
| Fußnotenziffern in Zahlen | Die Fußnotenziffer eines PDF steht im Text neben der Zahl (`Erwerbspersonen2`), der Zahlencheck liest sie als Teil der Zahl oder als eigene Zahl. Nicht gemessen, wie oft das vorkommt. |
| Tastaturkürzel            | Nicht gebaut.                                                                                                                                                                           |
| Suche über alle Notebooks | Nicht gebaut.                                                                                                                                                                           |

Bewusst nicht: EPUB, Google Docs und Slides (siehe [DESIGN-ABGLEICH.md](DESIGN-ABGLEICH.md)), Teilen, Audio- und Videoübersicht,
Deep Research, Drive, Daumen-Bewertung, PDF-Export, Rückgängig beim Löschen (jedes Löschen fragt vorher).

## Nicht gegen die aktuelle Doku geprüft

Hetzner-Preise und -Ausstattung, Fork-PR-Einstellungen auf GitHub, `EXPLAIN` der Vektorsuche, die Quellentypen von NotebookLM
selbst (Regel 12 aus AGENTS.md: vor einer Entscheidung dort nachsehen).
