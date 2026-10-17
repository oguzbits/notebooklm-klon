# Service-Level-Ziele

Was „gut genug“ heißt, damit ein Alarm einen Grund hat und ein schlechter Monat sichtbar wird. Die Zielwerte sind
Vorschläge, nicht aus Messungen abgeleitet; sie werden angepasst, sobald es Messwerte gibt. Was gemessen wird und was
nicht, steht in der letzten Spalte. Anleitung bei einem Alarm: [RUNBOOK.md](RUNBOOK.md).

| Ziel                  | Zielwert (30 Tage)                                                           | Messung                                                                    | Heute gemessen                                     |
| --------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| Erreichbarkeit        | 99,5 % der Prüfungen von `/health` antworten mit 200                         | Workflow [uptime.yml](../.github/workflows/uptime.yml), alle 15 Minuten    | Ja, als roter oder grüner Lauf; keine Auswertung   |
| Aufnahme läuft durch  | Keine Quelle länger als 15 Minuten ohne Ergebnis (`stalledSources` = 0)      | `/health`, Feld `stalledSources`                                           | Ja, im selben Workflow                             |
| Fehlerfreie Anfragen  | 99 % ohne Antwort 5xx                                                        | Sentry (unerwartete Fehler), Caddy-Zugriffslog                             | Teilweise: Fehler ja, Gesamtzahl der Anfragen nein |
| Antwortbeginn im Chat | 95 % der Antworten beginnen innerhalb von 5 Sekunden                         | Zeit bis zum ersten Stück des Streams                                      | Nein                                               |
| Zitiergenauigkeit     | Kein Rückgang der Maße der Baseline um mehr als `GATE_TOLERANCE`             | `pnpm eval:live` gegen [baseline.json](../apps/api/src/eval/baseline.json) | Ja, von Hand und bei Änderungen am Chat            |
| Datensicherheit       | Letzter Dump nicht älter als 26 Stunden; Wiederherstellung monatlich geprüft | `/srv/nlm/backup.log`, [restore-check.sh](../deploy/restore-check.sh)      | Nein, nur von Hand                                 |

## Fehlerbudget

Bei 99,5 % Erreichbarkeit sind in 30 Tagen etwa 3,6 Stunden Ausfall erlaubt. Ist das Budget verbraucht, kommt vor neuen
Funktionen die Ursache: eine Nachbetrachtung (was, warum, was ändert sich) in [BACKLOG.md](BACKLOG.md) oder als Commit-Text.

## Was fehlt zur echten Messung

Antwortbeginn und die Zahl aller Anfragen brauchen Metriken (siehe [SCALING.md](SCALING.md), „Metriken und Tracing“).
Bis dahin sind diese Ziele Absicht, nicht Zusage.
