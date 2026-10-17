# Wachstumspfad

Was sich ändert, wenn aus einem Server mit wenigen Nutzern ein Produkt für ein Team und viele Nutzer wird.
Jede Zeile nennt den ersten Engpass, die Maßnahme, ein Werkzeug und den Auslöser. Was heute gilt, steht in
[PLAN.md](PLAN.md), was offen ist, in [BACKLOG.md](BACKLOG.md). Werkzeugnamen vor dem Bau gegen die aktuelle Doku prüfen.

Stufen: **A** ein Server (heute), **B** ein Team betreibt es, zwei Instanzen, **C** viele Nutzer, mehrere Regionen.

## Laufzeit und Daten

| Bereich                          | Engpass                                                             | Maßnahme                                                                                                                   | Stufe |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| API und Worker im selben Prozess | Eine schwere Aufnahme bremst den Chat, ein Absturz reißt beides mit | Worker als eigener Container mit demselben Image (pg-boss braucht keinen Umbau), eigener Speicher- und CPU-Rahmen          | B     |
| Rate-Limiter                     | Zählt im Prozessspeicher, zwei Instanzen zählen getrennt            | Zustand in Postgres (Tabelle, Fenster per SQL); Redis/Valkey erst, wenn Postgres der Engpass ist                           | B     |
| Gast-Limit je Adresse            | Gleiches Problem, im Prozessspeicher                                | Mit dem Rate-Limiter zusammen nach Postgres                                                                                | B     |
| Chat-Stream (SSE)                | Offene Verbindungen binden Prozesse                                 | Mehr Instanzen hinter dem Load Balancer, Verbindungsgrenze je Instanz, Sticky Sessions nicht nötig (Zustand in der DB)     | B     |
| Studio läuft in einer Anfrage    | Langes Material hält die Anfrage offen                              | Als Auftrag in die Queue, Ergebnis per Abfrage (wie bei Quellen)                                                           | B     |
| Postgres                         | Eine Instanz, Verbindungen, Vektorsuche                             | Verbindungspool (PgBouncer), Lesereplikat für Suche, Partitionierung von `usage_events`, HNSW-Parameter messen (`EXPLAIN`) | C     |
| Objektspeicher                   | Titelbilder liegen nicht im Backup                                  | In das Backup aufnehmen (Stufe A genügt); bei C ein verwalteter S3-Dienst mit Versionierung                                | A, C  |
| Queue (pg-boss)                  | `retryLimit 0`, weil der Job die Upload-Bytes löscht                | Bytes erst nach Erfolg löschen, dann Wiederholung mit Backoff und Dead-Letter-Zustand                                      | B     |
| Modellanbieter                   | Ein Anbieter, ein Kontingent                                        | Zweiter Anbieter hinter derselben Schnittstelle (`ai/`), Fallback und Kostenvergleich, Batch-Aufrufe für Einbettungen      | C     |

## Zuverlässigkeit und Betrieb

| Bereich              | Maßnahme                                                                                                          | Stufe |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| SLOs                 | Zielwerte für Erreichbarkeit, Antwortbeginn im Chat, Zitiergenauigkeit; Alarm bei verbrauchtem Fehlerbudget       | B     |
| Runbook              | Eine Anleitung je Alarm: Symptom, Prüfung, Maßnahme, Rollback                                                     | B     |
| Metriken und Tracing | OpenTelemetry mit einem Backend (Grafana Cloud oder selbst gehostet), Spuren von der Anfrage bis zum Modellaufruf | C     |
| Zentrale Logs        | Weiterleitung der JSON-Zeilen (Alloy und Loki, Better Stack), Aufbewahrung festlegen                              | B     |
| Staging              | Gleiches Deploy-Skript auf einer zweiten Umgebung, Migrationen dort zuerst                                        | B     |
| Release              | Blue/Green oder Rolling mit Health-Check; Migrationen abwärtskompatibel (erst erweitern, dann ersetzen)           | B     |
| Feature-Flags        | OpenFeature mit GrowthBook oder Unleash, Teilfreigaben                                                            | C     |
| Notfallübung         | Restore-Probe regelmäßig im CI, Ziele für RPO und RTO festlegen                                                   | B     |
| Multi-Region         | Zweiter Standort, Datenbank-Replikation, DNS-Umschaltung; erst mit einem Verfügbarkeitsziel darüber               | C     |

## Sicherheit und Datenschutz

| Bereich                    | Maßnahme                                                                                                                                                | Stufe |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Zugriffsschutz             | Row-Level-Security als zweite Schicht, App-Rolle ohne Besitzerrechte, `SET LOCAL` je Anfrage                                                            | B     |
| Login                      | Standardmäßig für alle Routen, Ausnahmen explizit; Zwei-Faktor und Sitzungsverwaltung                                                                   | B     |
| Bot- und Missbrauchsschutz | Turnstile für Gäste, Limits je Konto und Adresse in Postgres, Anomalie-Alarm                                                                            | B     |
| Lieferkette                | SBOM, Image-Scan, Signierung mit Nachweis, gepinnte Basis-Images                                                                                        | B     |
| Geheimnisse                | Secret-Manager statt `server.env`, Rotation, getrennte Schlüssel je Umgebung                                                                            | B     |
| Datenschutz                | Datenschutzerklärung, Auftragsverarbeitung mit dem Modellanbieter, Löschkonzept (Konto löschen gibt es), Export, Aufbewahrungsfristen, Region der Daten | C     |
| Verschlüsselung            | Verschlüsselung der Backups und des Objektspeichers im Ruhezustand                                                                                      | B     |
| Prüfung                    | Regelmäßiger Penetrationstest, Bedrohungsmodell je neuer Angriffsfläche                                                                                 | C     |

## Qualität und Team

| Bereich                      | Maßnahme                                                                                                        | Stufe |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ----- |
| Lasttests                    | k6 gegen Staging mit festen Szenarien (Chat, Aufnahme), Grenzen in `LIMITS` daraus ableiten                     | B     |
| Eval                         | Mehr und schwerere Fragen, Wiederholungen je Frage, Replay offline, Gate in der CI (Details im Backlog)         | A, B  |
| Barrierefreiheit             | Automatische Prüfung (axe) im E2E, Screenreader-Test auf echten Geräten                                         | B     |
| Zusammenarbeit               | Pull Requests mit Pflicht-Prüfung, CODEOWNERS, Branch-Schutz, Architekturentscheidungen als kurze Dateien (ADR) | B     |
| Kosten                       | Budgetalarm je Tag und Monat, Kosten je Nutzer aus `usage_events` auswerten                                     | B     |
| Mehrere Teams oder Mandanten | Organisationen, Rollen, geteilte Notizbücher; verlangt Datenmodell und RLS gemeinsam zu denken                  | C     |
