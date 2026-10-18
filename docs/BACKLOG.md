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

Bis 2026-10-15 als „Demo“ nicht gebaut (siehe „Betrieb, Sicherheit, Skalierung“ unten, seit 2026-10-18 neu bewertet): dauerhafte Logs (Sentry meldet Fehler; Docker-Logs gehen beim Deploy verloren) und die Serverhärtung M10 (fail2ban, `deploy` aus der Docker-Gruppe, Trivy; Dependency-Audit läuft im CI, eine moderate Lücke in esbuild über drizzle-kit betrifft nur den Dev-Server). sslip.io teilt Zertifikatslimits; eine eigene Domain nur auf Wunsch.

## Betrieb, Sicherheit, Skalierung

Der Weg über diese Punkte hinaus (Stufen, Engpässe, Maßnahmen) steht in [SCALING.md](SCALING.md).

Maßstab: Die Seite wird wie ein Produkt eines Teams behandelt, wartbar und skalierbar (Entscheidung des Nutzers, 2026-10-18). Als Demo gilt sie nur bei den **Kosten**: kein Werkzeug, das Geld kostet oder eigene Server braucht, solange es keinen Grund dafür gibt.
Das ersetzt die frühere Entscheidung vom 2026-10-15 (Logs und M10 „weil Demo“). Werkzeugnamen sind aus dem Gedächtnis, vor dem Bau gegen die aktuelle Doku prüfen (Regel 12).

### Wird gebaut (kostenlos oder sehr günstig)

| Thema                     | Heute stattdessen                                                                                                                                  | Bestes Werkzeug                                                                                            | Auslöser zum Nachholen                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Alarm bei hängender Queue | `/health` meldet `stalledSources`, der Uptime-Lauf wird rot; Sentry-Regeln stehen im Runbook, sind aber noch nicht angelegt                        | Sentry Alerts und Cron Monitors auf Queue-Tiefe aus `/health`                                              | Aufträge bleiben unbemerkt liegen                |
| Row-Level-Security        | Gebaut, in CI getestet, `APP_DB_USER` und `APP_DB_PASSWORD` stehen in `server.env` ([DEPLOYMENT.md](DEPLOYMENT.md#zeilensicherheit-rolle-nlm_app)) | Offen: E2E-Server, Seeds und Job-Queue laufen als Besitzer                                                 | Sensiblere Daten oder mehrere Teams              |
| Image-Signierung (cosign) | Trivy-Scan und SBOM im CI; das Image geht per SSH zum Server, nicht über eine Registry                                                             | cosign (Sigstore) mit Artifact Attestations, setzt eine Registry voraus (GHCR) und einen geänderten Deploy | Deploy über eine Registry oder Echte Nutzerdaten |

### Braucht ein neues Konto oder Geld (Backlog, erst nach Freigabe)

Regel: Alles, was ein neues Konto, Schlüssel oder einen zusätzlichen Server braucht, baut der Agent nicht allein.

| Thema                     | Heute stattdessen                                                                     | Bestes Werkzeug                                                                | Auslöser zum Nachholen                              |
| ------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| Captcha für Gäste         | Limit je Adresse, je Stunde, gleichzeitig; Tagesbremse für Tokens                     | Cloudflare Turnstile (kostenlos, ohne Tracking)                                | Gäste werden trotz Limit gezielt ausgesperrt        |
| Dauerhafte, zentrale Logs | Docker-Logs (gehen beim Deploy verloren), Sentry                                      | Grafana Alloy mit Loki (Grafana Cloud) oder Better Stack                       | Fehler lassen sich ohne Logs nicht mehr eingrenzen  |
| Staging-Umgebung          | CI mit DB, S3 und E2E, Deploy mit Health-Check, Image `nlm-app:previous` für Rollback | Zweiter kleiner Hetzner-Server mit demselben `deploy.yml`, GitHub Environments | Mehrere Entwickler oder Schemaänderungen ohne Probe |

### Zurückgestellt (kostet Geld oder braucht Wachstum)

| Thema                         | Heute stattdessen                                      | Bestes Werkzeug                                                                                       | Auslöser zum Nachholen                              |
| ----------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Lasttests                     | Kontingent und Tagesbremse begrenzen die Last          | k6 (Skripte in TypeScript/JS, läuft im CI)                                                            | Werbung für die Seite oder mehr als etwa 50 Nutzer  |
| Metriken, Dashboards, Tracing | Sentry für Fehler, `X-Request-Id` im Log, Uptime-Check | OpenTelemetry SDK mit Grafana Cloud (Free-Tarif); als kleinere Stufe Sentry Tracing, das schon da ist | Mehr als ein Server oder ein Ziel für Antwortzeiten |
| Rate-Limiter über Instanzen   | Im Prozessspeicher, ein Server                         | Tabelle in Postgres; bei Bedarf `rate-limiter-flexible` mit Postgres- oder Redis-Speicher             | Zweite API-Instanz                                  |
| Multi-Region, Orchestrierung  | Ein Hetzner-Server mit Backup und Restore-Probe        | Hetzner Load Balancer mit zweitem Server; k3s erst bei vielen Diensten                                | Verfügbarkeitsziel über dem eines Servers           |
| Feature-Flags                 | Deploy mit Rollback                                    | GrowthBook oder Unleash (selbst gehostet), Schnittstelle OpenFeature                                  | Teilfreigaben für Nutzergruppen                     |

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
