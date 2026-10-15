# Plan 1: Beobachtbarkeit

Stand: 2026-10-15. Gebaut, bis auf die unten genannten offenen Punkte.

## Ziel

Ein gemeldeter Fehler lässt sich mit einer ID bis zur Ursache verfolgen, ohne Dokumentinhalt im Log (Invariante 7).

## Gebaut

- Job-Fehlerlog mit `sourceId`, `userId`, `kind`, `bytes`, `stage`, `errorName`, `durationMs`. Fehlt der Upload, fehlen `userId`, Art und Größe.
- Upload-Ablehnung wird mit Grund, Art, Größe und Statuscode geloggt, nie mit dem Dateinamen.
- Request-ID (`X-Request-Id`, von Caddy oder erzeugt) in allen Logzeilen und Fehlerantworten (`requestId` im gemeinsamen Fehlerschema). Caddy-Zugriffslog an.
- Ein Journal des Servers wurde gebaut und auf Wunsch des Nutzers wieder entfernt. Die Docker-Logs (`json-file`) gehen mit dem Container verloren.
- Sentry (EU-Region): API in [observability/](../../apps/api/src/observability) (`@sentry/node`, Port `ErrorReporter`), Web in [error-reporting.ts](../../apps/web/src/lib/error-reporting.ts).
  Gemeldet werden unerwartete Fehler (500), fehlgeschlagene Import-Jobs, Fehler der Job-Queue und des Chats; auf einen Status abgebildete Fehler nicht.
- Was gesendet wird, legt eine Liste erlaubter Felder fest (`scrubEvent`): Fehlerart, Stapel, Release, Umgebung, Tags, Kennungen der Source Maps.
  Nie: Fehlertext, Variablen, Quelltext, Anfrage, Nutzer, Breadcrumbs. Release = Commit (`GIT_SHA`). Ohne `SENTRY_DSN` / `VITE_SENTRY_DSN` startet das SDK nicht.
- Source Maps des Web gehen beim Deploy-Build per `@sentry/vite-plugin` zu Sentry und werden danach gelöscht. `SENTRY_AUTH_TOKEN` ist ein Build-Secret.
- Sentry-MCP-Server zum Untersuchen: je Benutzer eingerichtet, nicht im Repo, nur für eine Untersuchung einschalten.
- Uptime-Ping: Workflow „Uptime“. Opsgenie läuft aus, nicht neu wählen.

## Offen

Nichts, was gebaut wird. Dauerhafte, durchsuchbare Logs und das Lesen von Server-Logs per SSH sind bewusst nicht gebaut (Entscheidung des Nutzers, 2026-10-15, siehe [BACKLOG.md](../BACKLOG.md)): Sentry meldet Fehler, und die Seite ist eine Demo.
