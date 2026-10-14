# Plan 1: Beobachtbarkeit

## Ist (im Code belegt)

- `apps/api/src/index.ts` (Job-Fehler): Log ohne `sourceId`, `userId`, Art, Größe und Stufe.
- 4xx-Ablehnungen beim Upload werden nicht geloggt.
- Keine Request-ID, kein Zugriffslog in Caddy.
- Docker-Logs (`json-file`, 3 x 10 MB) gehen bei jedem Deploy verloren, weil `up -d` den Container ersetzt.
- Vorhanden: Fehlercodes `SOURCE_FAILURE`, `AnswerTrace` am Chat.
- Ein vor über einer Woche gemeldeter Uploadfehler ist daher meist nicht mehr nachzuvollziehen.

## Ziel

Ein gemeldeter Fehler lässt sich mit einer ID bis zur Ursache verfolgen, ohne Dokumentinhalt im Log (Invariante 7).

## Schritte

1. **Job-Fehlerlog**: Felder `sourceId`, `userId`, `kind`, `bytes`, `stage` (Parsen, Aufteilen, Einbetten, Speichern), `errorName`, `durationMs`.
2. **Upload-Ablehnung**: Log mit Grund (Code), `kind`, `bytes`, Statuscode. Kein Dateiname im Klartext, nur Länge.
3. **Request-ID**: Middleware setzt `X-Request-Id` (kommt von Caddy, sonst erzeugt), alle Logzeilen und Fehlerantworten tragen sie.
   Im Fehlertext für Nutzer erscheint eine kurze Referenz, die der Nutzer melden kann.
4. **Dauerhafte Logs**: Docker-Log in Volume oder Treiber mit Rotation, die Deploys überlebt. Caddy-Zugriffslog an.
5. **Sentry (EU, Frankfurt)** für Fehler und Release-Zuordnung: erst nach Entscheidung, weil externer Dienst und Datenschutz.
   Vor dem Einbau Region, Preis und Datenfelder (`sendDefaultPii` aus, keine Bodys) in der aktuellen Doku prüfen.
6. **Uptime-Ping** gibt es schon (Workflow „Uptime“). Alarm-Dienst: Opsgenie läuft aus (Verkaufsende 2025-06-04), nicht neu wählen.

## Interfaces

- `log(entry)` in `apps/api/src/logger.ts` bleibt; neue Felder kommen als Typ aus einem Schema, nicht frei als Objekt.
- Fehlerantwort-Schema in `packages/shared` bekommt optional `requestId`.

## Testfälle

- Job scheitert beim Parsen: Logzeile enthält `sourceId`, `userId`, `kind`, `stage` = Parsen, keinen Inhalt.
- Upload mit zu großer Datei: 4xx und Logzeile mit Grund.
- Antwort enthält `X-Request-Id`; eine mitgeschickte ID wird übernommen, eine ungültige (zu lang, Sonderzeichen) ersetzt.
- Logzeile enthält nie den Dateinamen oder Textinhalt (Test mit eindeutigem Marker im Inhalt).

## Welcher Test wird rot

- Feld `stage` aus dem Log nehmen: Test „Job scheitert beim Parsen“.
- Request-ID-Prüfung entfernen: Test „ungültige ID ersetzt“.
- Dateinamen ins Log schreiben: Test „kein Inhalt im Log“.

## Stand (2026-10-14)

Gebaut: Schritte 1 bis 3 (Job-Fehlerlog, Upload-Ablehnung, Request-ID) und das Caddy-Zugriffslog. Schritt 4 (Journal des Servers) wurde gebaut und auf Wunsch des Nutzers wieder entfernt; die Logs bleiben beim Docker-Treiber `json-file` und gehen mit dem Container verloren. Dauerhafte Logs übernimmt ein Dienst (siehe unten). Beim Job-Fehler ist die `sourceId` auch dann im Log, wenn der Upload fehlt;
es fehlen dann `userId`, Art und Größe. Ohne `sourceId` bleibt nur eine fehlerhafte Job-Nutzlast.

## Sentry (gebaut 2026-10-14, EU-Region)

- API: [observability/](../../apps/api/src/observability) (`@sentry/node`, ein eigener Port `ErrorReporter`). Gemeldet werden unerwartete Fehler einer Anfrage (500), ein fehlgeschlagener Import-Job, Fehler der Job-Queue und des Chats. Fehler, die die App auf einen Status abbildet (Limit erreicht, nicht gefunden), gehören nicht dazu. Tags: `origin`, `requestId`, `sourceId`, `stage`, `code`. Beim Beenden (SIGTERM) wartet die App, bis Gemeldetes gesendet ist.
- Browser: [error-reporting.ts](../../apps/web/src/lib/error-reporting.ts) (`@sentry/react`), meldet Fehler, die die Seite abbrechen, und globale Fehler.
- **Was gesendet wird, legt eine Liste erlaubter Felder fest** (`scrubEvent`, in API und Web): Fehlerart, Stapel (Datei, Funktion, Zeile), Release, Umgebung, Tags und die Kennungen der Source Maps (`debug_meta`, ohne sie findet Sentry die Karte nicht). **Nie:** Fehlertext (er kann Dokumentinhalt zitieren, Invariante 7), Variablen, Quelltextzeilen, Anfrage, Adresse, Nutzer, Breadcrumbs. Ein Feld, das ein späteres SDK ergänzt, entfällt, bis es dort erlaubt wird. `dataCollection` ist ausdrücklich ausgeschaltet, weil seit SDK 11 die Standardwerte immer gelten.
- Das Release ist der Commit (`GIT_SHA` als Build-Argument in [Dockerfile](../../Dockerfile) und [deploy.yml](../../.github/workflows/deploy.yml)).
- Ohne `SENTRY_DSN` (API) oder `VITE_SENTRY_DSN` (Build des Web) startet das SDK nicht.
- Zum Untersuchen von Fehlern gibt es den Sentry-MCP-Server, je Benutzer eingerichtet und nicht im Repository: `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp/oguz-gd` (Anmeldung per OAuth beim ersten Gebrauch). Er bleibt ausgeschaltet (`/mcp`) und wird nur für eine Untersuchung eingeschaltet. Ob der gehostete Server die EU-Region (`de.sentry.io`) unterstützt, steht nicht in der Doku und ist beim ersten Gebrauch zu prüfen.
- Geprüft mit dem echten SDK gegen einen lokalen Server: im gesendeten Ereignis steht der Inhalt des Fehlertextes nicht.

## Offen

- **Sentry-Schlüssel:** Erledigt. `SENTRY_DSN` (Projekt `notebooklm-hono`) ist auf dem Server gesetzt und funktioniert (Nutzer bestätigt 2026-10-15). `SENTRY_WEB_DSN` (Projekt `notebooklm-react`) ist als GitHub-Secret gesetzt; sie steht ohnehin im öffentlichen Bundle.
- **Source Maps für das Web: gebaut.** Der Deploy-Build lädt sie mit `@sentry/vite-plugin` zu Sentry (Organisation `oguz-gd`, Projekt `notebooklm-react`, Release = Commit) und löscht sie danach, der Server liefert sie nie aus. Das Token `SENTRY_AUTH_TOKEN` (Organization Token, GitHub-Secret) ist ein Build-Secret von Docker und steht weder im Image noch in einer Schicht. Ein fehlgeschlagener Upload warnt nur und stoppt den Deploy nicht; dann zeigen Fehler minifizierte Stellen. Ohne Token (lokal, CI) entstehen keine Maps. Das Plugin braucht das Programm `@sentry/cli`, dessen Installationsskript in `pnpm-workspace.yaml` erlaubt ist.
- Das Lesen vorhandener Logs der gemeldeten Zeit auf dem Server braucht SSH-Zugriff; nur mit Freigabe des Nutzers.
- Log-Dienst für dauerhafte, durchsuchbare Logs: Entscheidung offen. Kandidaten sind Grafana Cloud Free und eine selbst betriebene Variante (Loki); vor dem Einbau Limits gegen die offizielle Seite prüfen.
