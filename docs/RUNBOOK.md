# Runbook

Eine Anleitung je Alarm: Symptom, Prüfung, Maßnahme. Befehle laufen auf dem Server als `deploy` in `/srv/nlm` mit der Kurzform
`dc() { docker compose -f docker-compose.prod.yml --env-file server.env "$@"; }` (siehe [DEPLOYMENT.md](DEPLOYMENT.md#betrieb)).
Ziele und Zahlen: [SLO.md](SLO.md).

## Uptime-Lauf rot: `/health` antwortet nicht

1. `curl -si https://<Hostname>/health` von außen. Kommt kein Zertifikat oder keine Antwort: Caddy oder DNS (`dc logs --tail 100 caddy`).
2. `dc ps`: Ist `app` oder `db` nicht `healthy`? `dc logs --tail 200 app` ansehen.
3. Nach einem Deploy: Der Workflow rollt selbst zurück; ob `nlm-app:current` das alte Image ist, steht im Deploy-Lauf. Sonst von Hand zurück (Abschnitt „Zurück auf die vorige Version“ in DEPLOYMENT.md).
4. Ein von Docker beendeter Container: `docker inspect <Name> --format '{{.State.OOMKilled}}'`. Bei `true` Speichergrenzen in der Compose-Datei prüfen.
5. Datenbank kaputt oder Daten weg: Wiederherstellung aus dem Dump (Abschnitt „Backup und Wiederherstellung“).

## Uptime-Lauf rot: `stalledSources` ist größer als 0

Mindestens eine Quelle wartet seit mehr als 15 Minuten auf ihren Aufnahme-Auftrag.

1. `curl -s https://<Hostname>/health`: Wie viele? Bleibt die Zahl über mehrere Läufe gleich oder steigt sie, hängt die Queue.
2. `dc logs --tail 200 app | grep -E "ingestion job|queue error"`: Fehlschläge stehen mit Quelle-ID, Stufe und Dauer drin, nie mit Inhalt.
3. Schlägt jeder Auftrag beim Anbieter fehl (Gemini-Kontingent, Schlüssel): im Log den Fehlernamen lesen; die Tagesbremse und das Free-Tier-Limit prüfen.
4. `dc restart app` startet den Worker neu. Quellen, deren Auftrag älter als eine Stunde ist (`INTERRUPTED_JOB_AFTER_MS`), markiert der Anlauf als „unterbrochen“; Nutzer können die Quelle erneut lesen.
5. Hilft das nicht: Ursache in Sentry suchen (Herkunft `ingestion` oder `queue`), die Quelle-ID steht als Tag.

## Fehler in Sentry (Herkunft `request`, `ingestion`, `queue`, `chat`)

1. Das Tag `requestId` (falls vorhanden) in Caddys Zugriffslog und in den Logzeilen der App suchen: `dc logs app | grep <requestId>`.
2. Release (= Commit) im Ereignis zeigt, welche Version den Fehler wirft. Trat er mit dem letzten Deploy auf, zurückrollen.
3. Eine Nutzerbeschwerde enthält die „Referenz“ (die ersten acht Zeichen der Anfrage-ID): damit im Log suchen.

## Kontingent des Modellanbieters erschöpft

Symptom: Chat und Aufnahme schlagen mit Fehlern des Anbieters fehl, die Oberfläche meldet das Tageslimit oder einen Fehler.

1. `pnpm report:usage` (lokal gegen die Datenbank) zeigt Tokens je Aufruf und Tag.
2. Ist die Tagesbremse (`DAILY_TOKEN_BUDGET`) erreicht, ist das gewollt; sie öffnet sich im nächsten Fenster. Ändern nur nach Blick auf das Guthaben beim Anbieter.
3. Ist das Guthaben beim Anbieter leer, dort aufladen; kein Neustart nötig.

## Gäste lassen sich nicht starten

Antwort 503 auf `/api/guest`: Entweder fehlt das Beispiel-Notizbuch (Seed lief nicht), oder eines der Limits ist erreicht
(`GUESTS_PER_HOUR`, `GUESTS_PER_IP_PER_HOUR`, `GUESTS_ALIVE`). Ein Limit je Adresse trifft viele Nutzer hinter einer Adresse zugleich.
Die Zählung je Adresse liegt im Prozessspeicher: `dc restart app` setzt sie zurück, falls ein Skript die Stunde belegt hat.

## Nutzer sehen plötzlich keine Daten mehr (Zeilensicherheit)

Die App verbindet als Rolle `nlm_app`; Postgres liefert ihr nur Zeilen des Nutzers, für den die Anfrage läuft. Leere Listen bei
gesunder Datenbank heißen meist: Eine Abfrage lief ohne `forUser` und damit ohne Nutzer (sie liefert dann nichts, sie leckt nichts).
`dc logs app` und Sentry zeigen die Route. Als Sofortmaßnahme `APP_DB_USER` und `APP_DB_PASSWORD` aus `server.env` entfernen und
`dc up -d app`: die App verbindet wieder als Besitzer, ohne Zeilensicherheit. Danach den Fehler beheben, nicht die Policy abschwächen.

## Sentry-Alert-Regeln (einmal im Sentry-Projekt anlegen)

Das lässt sich nur in der Oberfläche von Sentry einrichten, nicht aus dem Repo.

- Neues Problem in `notebooklm-hono` mit Herkunft `queue` oder `ingestion`: sofort per Mail.
- Mehr als 5 Ereignisse in 10 Minuten im selben Problem: per Mail.
- Neues Problem in `notebooklm-react`: tägliche Zusammenfassung genügt.

## Nach dem Vorfall

Kurze Notiz als Commit-Text oder im Backlog: Was war es, wie wurde es bemerkt, was ändert sich (Alarm, Test, Dokument).
