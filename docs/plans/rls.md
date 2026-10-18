# Plan: Row-Level-Security als zweite Schicht

Wird nach der Umsetzung gelöscht (Git-Historie), offene Reste gehen ins [Backlog](../BACKLOG.md). Entwurf, noch nicht freigegeben.

**Ziel:** Ein vergessener oder falscher `WHERE` in einer Abfrage kann keine Daten eines anderen Nutzers liefern, weil Postgres die Zeilen selbst filtert (Invariante 3 bekommt eine zweite Schicht).
**Nicht Ziel:** Mandanten, Teams, geteilte Notizbücher; Schutz gegen einen Angreifer mit Zugriff auf die Datenbank; Better-Auth-Tabellen.
**Beweis:** `pnpm test:db` enthält Tests, die mit der App-Rolle ohne Nutzerkontext keine Zeile sehen und mit fremdem Kontext keine fremde Zeile; `pnpm check`, `pnpm test`, `pnpm e2e` grün.

## Entscheidungen

1. **Zwei Rollen.** `nlm` (Besitzer: Migrationen, Systemarbeit) und `nlm_app` (`LOGIN`, kein Besitzer, kein `BYPASSRLS`, nur DML). Der Besitzer umgeht RLS ohne `FORCE`; das ist für Systemarbeit gewollt. Eine eigene Migration (`0025_nlm_app_role`, mit `drizzle-kit generate --custom`) legt die Rolle ohne Passwort und ohne Login an, falls es sie nicht gibt, und vergibt die `GRANT`s samt Standardrechten; so bricht die Migration auf dem vorhandenen Server nicht ab. `LOGIN` und Passwort setzt `deploy/provision.sh` (S3) und die Testumgebung (`global-setup.ts`). Drizzle: `pgRole('nlm_app').existing()`, `pgPolicy`, `.enableRLS()` (in drizzle-orm 0.45.3 vorhanden; vor dem Bau gegen die Doku prüfen, Regel 12). SQL kommt aus `drizzle-kit generate`, nie von Hand (Regel 11).
2. **Nutzerkontext je Transaktion.** `withUser(db, userId, fn)` in `db/client.ts`: eine Transaktion, darin `select set_config('app.user_id', $1, true)`. Richtlinien: `user_id = current_setting('app.user_id', true)`. Fehlt die Einstellung, ist sie NULL und es kommt keine Zeile zurück (schließt im Zweifel zu).
3. **Tabellen.** Mit `user_id`: `notebooks`, `sources`, `chat_messages`, `notes`, `studio_outputs`, `usage_events` (`USING` und `WITH CHECK`). Ohne `user_id`: `notebook_sources`, `chunks`, `source_uploads` über `EXISTS` auf die Elterntabelle. Keine RLS auf den Better-Auth-Tabellen (die Anmeldung kennt den Nutzer erst danach).
4. **Systemzugriff ist benannt.** Ein eigenes Modul `db/system/` hält die Besitzer-Verbindung (`DATABASE_OWNER_URL`). Nur dort und in der Liste unten wird sie benutzt; eine depcruise-Regel verbietet den Import sonst. Systempfade: Aufnahme-Worker, `failInterruptedSources`, `countStalledSources`, `deleteExpiredGuests`, `countGuests`, Gast-Vorlage und Kopie (`findDemoTemplate`, `copyNotebookToUser`), Tagesbremse über alle Nutzer (`tokensSince`), `/health`, Seed, `report:usage`. `recordUsage` läuft mit `withUser`, wo der Nutzer bekannt ist.
5. **Chat hält keine Transaktion über den Stream.** Suche, Antwort speichern und Quellen laden sind je ein kurzes `withUser`; der Modellstrom läuft außerhalb.
6. **Messung der Vektorsuche.** `EXPLAIN` der Suche vor und nach der Richtlinie auf `chunks`. Verliert die Suche dadurch ihren Index, bekommt `chunks` eine eigene Spalte `user_id` (Migration, Rücknahme der `EXISTS`-Richtlinie). Entscheidung nach der Messung.

## Stufen (je ein Commit, jeweils grün)

- **S1 Grundlage, kein Verhaltenswechsel (erledigt, siehe Git).** Rollen-Migration, Richtlinien, Test-Setup, `withUser`, Richtlinien und `GRANT`s als Migration, Konfiguration (`DATABASE_URL` = App-Rolle, `DATABASE_OWNER_URL`) in `config/env.ts`. Die App verbindet in S1 noch als Besitzer.
- **S2 Routen auf `withUser` umstellen (erledigt, siehe Git; abweichend vom Entwurf).** Statt die Signaturen der Repositories zu ändern, ist `Database` jetzt der gemeinsame Typ von Pool und Transaktion, und `forUser(deps, userId, (db) => ...)` in den Routen öffnet die Transaktion. Die Systempfade nehmen `deps.systemDb` (`DATABASE_OWNER_URL`, sonst `DATABASE_URL`): Gäste, Tagesbremse, `/health`, Aufnahme (Quellen und Uploads, auch beim Einreichen), Sweeps. Die DB-Tests laufen mit der App-Rolle. Ursprünglicher Text: Reihenfolge: `notebooks`, Quellen und Leser, Notizen, Studio, Nutzung, Chat und Suche, Übersichten. Die Route reicht den Nutzer aus der Sitzung durch; die Signaturen der Repositories nehmen `UserDb` (die Transaktion) statt `Database`.
- **S3 Umschalten.** Produktion verbindet als `nlm_app`; `server.env` bekommt `DATABASE_OWNER_URL`, Rollenpasswort (Secret, vom Nutzer anzulegen), [DEPLOYMENT.md](../DEPLOYMENT.md) und Runbook ergänzen. Rücknahme: `DATABASE_URL` zurück auf den Besitzer.

## Testfälle (Liste)

1. App-Rolle ohne Kontext liest keine Zeile jeder geschützten Tabelle (je Tabelle).
2. Mit Kontext von Nutzer A liest sie nur A; mit B nur B; Schreiben mit fremder `user_id` scheitert (`WITH CHECK`).
3. Kind-Tabellen: `chunks` und `notebook_sources` einer fremden Quelle sind unsichtbar.
4. Eine Route, deren `WHERE` absichtlich fehlt (Testrepository), liefert trotzdem nichts Fremdes.
5. Besitzer-Verbindung sieht alles (Systempfade funktionieren), z. B. Gast-Kopie und Tagesbremse.
6. `withUser` setzt den Kontext nur für die Transaktion (danach NULL; keine Leckage über den Pool).
7. depcruise schlägt an, wenn ein Modul außerhalb von `db/system/` die Besitzer-Verbindung holt.

**Jeder Schutz und der Test, der ohne ihn rot wird:** Richtlinie entfernt: 1 bis 3. `FORCE`/Rolle fälschlich als Besitzer: 1. `set_config` nicht lokal (`false` statt `true`): 6. Systemmodul-Regel entfernt: 7.

## Offene Punkte für den Nutzer

- Ein neues Geheimnis (Passwort der Rolle `nlm_app`) muss in `server.env` und die Test-Umgebung. Das lege ich nicht allein an.
- S2 fasst fast jedes Repository an. Soll das in einem Zug laufen oder je Repository mit eigenem Commit (Vorschlag)?
