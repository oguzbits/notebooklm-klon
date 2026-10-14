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

## Offen

- **Sentry (EU, Frankfurt): entschieden, kommt.** Der Nutzer will eine Lösung, wie Unternehmen sie nutzen. Vor dem Einbau gegen die aktuelle Doku prüfen: SDK für Node (Hono) und React,
  EU-Region, `sendDefaultPii` aus, Bodys und Fehlertexte entfernen (Invariante 7: Fehlermeldungen können Dokumentinhalt zitieren, also nur Name und Stapel senden), `requestId` als Tag,
  Release aus dem Git-Hash, Source Maps für das Web. Der Nutzer legt Projekte und DSN an; der Schlüssel steht nur in der Umgebung (`SENTRY_DSN` optional, ohne Wert passiert nichts).
- Das Lesen vorhandener Logs der gemeldeten Zeit auf dem Server braucht SSH-Zugriff; nur mit Freigabe des Nutzers.
- Log-Dienst für dauerhafte, durchsuchbare Logs: Entscheidung offen. Kandidaten sind Grafana Cloud Free und eine selbst betriebene Variante (Loki); vor dem Einbau Limits gegen die offizielle Seite prüfen.
