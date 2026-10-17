# Stand und Backlog

Aus dem Gesamtreview vom 2026-10-02 (vier lesende Prüfungen und ein Journey-Lauf auf der Live-Seite).
Die erledigten Punkte stehen in der
Git-Historie; hier steht nur, was offen ist oder bewusst nicht gebaut wird.

## Stand

Alle Befunde der Stufen „Hoch“ (H1 bis H7) sind behoben. Von den mittleren sind M1, M2, M3, M5 und M8 bis M17 erledigt, M6 (Titel auf 200 Zeichen gekürzt, DOCX und PPTX auf 100 MB entpackt begrenzt), M7 bis auf den Tarif-Hinweis;
M10 bewusst nicht gebaut (siehe unten); M4 trifft nicht zu (siehe unten). Die Funktionslücken aus dem Review
(neu einlesen, Export, Konto löschen, Stopp-Button) und die Dateitypen PDF-Link, Bilder, Audio, PPTX und YouTube sind gebaut.

Gates auf dem letzten Stand: `pnpm check`, `pnpm test`, `pnpm test:db` und `pnpm e2e` grün.
Nicht geprüft: Screenreader auf echten Geräten, echte Mobilgeräte, Semgrep lokal (läuft im CI).

## Entscheidungen des Nutzers

- Datenschutzerklärung und Impressum: nicht nötig.
- Kopie des Backups auf einen anderen Server: nicht nötig. Dump vor jedem Deploy und Restore-Probe (`deploy/restore-check.sh`) gibt es.
- Hinweis zum Gemini-Tarif im Upload-Dialog: zurückgestellt, solange die Seite eine Demo ist. Das README warnt davor, sensible Dokumente hochzuladen.

## Offen

| #   | Thema | Befund | Fix |
| --- | ----- | ------ | --- |

M4 (HNSW-Index mit Filter) trifft nicht zu: Die Suche ordnet nach Abstand über die CTE `scoped`, die über Verbindungen auf Nutzer, Notizbuch und Quellen gefiltert ist ([db/retrieval.ts](../apps/api/src/db/retrieval.ts)). Der HNSW-Index kann darüber nicht angewandt werden, der Scan ist exakt und verliert keine Treffer an einen nachgelagerten Filter. Aus dem Aufbau der Abfrage geschlossen, nicht mit `EXPLAIN` gemessen. Neu bewerten, wenn die Suche je auf den Index ausgerichtet wird.

Bewusst nicht gebaut, weil die Seite eine Demo ist (Entscheidung des Nutzers, 2026-10-15): dauerhafte Logs (Sentry meldet Fehler; Docker-Logs gehen beim Deploy verloren) und die Serverhärtung M10 (fail2ban, `deploy` aus der Docker-Gruppe, Trivy; Dependency-Audit läuft im CI, eine moderate Lücke in esbuild über drizzle-kit betrifft nur den Dev-Server). sslip.io teilt Zertifikatslimits; eine eigene Domain nur auf Wunsch.

## Bewusst nicht gebaut (Betrieb, Sicherheit, Skalierung)

Die Seite ist eine Demo mit wenigen Besuchern und einem Server. Diese Punkte sind bekannt und geprüft, nicht vergessen.
„Auslöser“ nennt, was sich ändern müsste, damit sie sich lohnen.

| Thema                                | Heute stattdessen                                                                                | Auslöser zum Nachholen                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Captcha (Turnstile) für Gäste        | Limit je Adresse, je Stunde, gleichzeitig; Tagesbremse für Tokens                                | Gäste werden trotz Limit gezielt ausgesperrt            |
| Metriken, Dashboards, Tracing (OTel) | Sentry für Fehler, `X-Request-Id` im Log, Uptime-Check                                           | Mehr als ein Server oder ein Ziel für Antwortzeiten     |
| Dauerhafte, zentrale Logs            | Docker-Logs (gehen beim Deploy verloren), Sentry                                                 | Fehler lassen sich ohne Logs nicht mehr eingrenzen      |
| Alarm bei hängender Queue            | Unterbrochene Aufträge werden erkannt (`INTERRUPTED_JOB_AFTER_MS`), Nutzer kann erneut versuchen | Aufträge bleiben unbemerkt liegen                       |
| Staging-Umgebung                     | CI mit DB, S3 und E2E, Deploy mit Health-Check und Image `nlm-app:previous` für Rollback         | Mehrere Entwickler oder Änderungen am Schema ohne Probe |
| Rate-Limiter in Postgres oder Redis  | Im Prozessspeicher, ein Server                                                                   | Zweite API-Instanz                                      |
| Row-Level-Security                   | Jede Abfrage filtert nach `userId`, Tests prüfen das                                             | Sensiblere Daten oder mehrere Teams                     |
| Image-Signierung, SBOM, Trivy (M10)  | Dependabot, `pnpm audit`, Semgrep, gepinnte Actions                                              | Echte Nutzerdaten                                       |
| Lasttests                            | Kontingent und Tagesbremse begrenzen die Last                                                    | Werbung für die Seite oder mehr als etwa 50 Nutzer      |
| Multi-Region, Kubernetes             | Ein Hetzner-Server mit Backup und Restore-Probe                                                  | Verfügbarkeitsziel über dem eines Servers               |
| Feature-Flags                        | Deploy mit Rollback                                                                              | Teilfreigaben für Nutzergruppen                         |
| SLOs                                 | Keine Zusagen; Uptime-Check zeigt nur Erreichbarkeit                                             | Nutzer außerhalb der Demo                               |

Kleinigkeiten:

- `use-sources.ts`: Abfrage alle 2 s ohne Backoff, solange eine Quelle arbeitet. Bewusst gelassen: eine kurze, billige Abfrage während weniger Minuten.
- Hash über rohe HTML-Bytes: dynamische Seiten werden nie als Duplikat erkannt.
- Rohe Controls statt shadcn an einigen Stellen (`quiz-option.tsx`, `studio-tiles.tsx`, `library-row.tsx`), nicht einzeln beurteilt.
- `pdf-lib` hat seit November 2021 kein Release mehr, funktioniert aber.

## Aus den Plänen (Stand 2026-10-15)

Die Pläne sind abgeschlossen und gelöscht (Git-Historie, Commit vor diesem). Offen daraus:

- **Eval:** n >= 3 je Frage und die Schwelle des Gates aus der Schwankung statt geschätzt; Korpus (`spikes/corpus`) mit geklärter Lizenz ins Repo; Replay der Modellantworten offline (Invariante 5);
  **schwerere Fragen** (Quellen vergleichen, Zahlen aus Tabellen, deutsche Fragen zu englischen Quellen), weil die Menge bei 100 % nichts mehr zeigt.
- **RAG-Experimente**, erst mit schwereren Fragen, je Experiment eine Variable und ein Lauf mit n >= 3, Neu-Einbetten vorher beziffern und abstimmen:
  E1 ganze Quellen statt Suche, wenn sie passen; E2 Volltext mit deutschem Wortstamm statt `simple` (Migration); E3 Chunkgröße 800, 1500, 2500; E4 Passagenzahl 6, 12, 20; E5 Quellentitel in den Einbettungstext; E6 Reranker (nur wenn E1 bis E5 nicht reichen).
- **Temperatur und `thinkingLevel`:** heute überall 0 und ungesetzt (`ai/gemini-chat.ts`, `ai/gemini-pdf-parser.ts`). Gemini 3 empfiehlt laut Doku 1,0 (neu lesen). Wenn gemessen wird: `GENERATION = { CHAT, QUERY, PDF, STUDIO }` in `apps/api/src/config`,
  je Rolle 0 gegen 1,0, n >= 3, grob 1 bis 2 Euro. Ein Test je Rolle, dass der Anfragekörper den Wert aus der Konfiguration trägt.
- **Limits eichen:** Die Notbremse von 2 Millionen Tokens am Tag folgt aus einem Guthaben von etwa 4 € (2026-10-15) und den Preisen von gemini-3.5-flash-lite (0,30 USD je Million Eingabe-, 2,50 USD je Million Ausgabe-Tokens inklusive Thinking; ai.google.dev/gemini-api/docs/pricing, 2026-10-14 per Agent gelesen, nicht von Hand geprüft); eine Chat-Frage kostete am 2026-10-15 gemessen etwa 0,35 Cent. Höhen der Limits je Nutzer und `MAX_OUTPUT_TOKENS` aus echter Nutzung (`pnpm report:usage`). Höhen der Limits je Nutzer und `MAX_OUTPUT_TOKENS` aus echter Nutzung (`pnpm report:usage`). Ob `maxOutputTokens` Thinking-Tokens mitzählt, ist nicht eindeutig: Die Thinking-Doku sagt für `max_output_tokens` „including thought tokens“
  (ai.google.dev/gemini-api/docs/thinking, per Agent gelesen), die Referenz von `generationConfig.maxOutputTokens` wurde nicht gelesen; bei Erreichen kann die Ausgabe gekürzt oder leer sein. Vor dem Verkleinern mit einem Aufruf messen.
- **Doku:** Datumsvergleich `Stand` gegen die letzte Änderung eines zugeordneten Pfads (Schicht 3 von früher Plan 2) nachrüsten, wenn trotz `docs-map.json` Doku veraltet.

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
