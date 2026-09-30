# Entscheidungen

Kleine Entscheidungen, die der Agent selbst getroffen hat, mit Begründung. Große Entscheidungen
(Umfang, Kosten, Datenschutz) liegen beim Nutzer. Der Nutzer liest die Liste und korrigiert.

Format: Datum, Entscheidung, Begründung, was sie später ändern würde.

## 2026-09-30

- **Regeln gelockert (auf Wunsch des Nutzers):** Commits und Pushes sind erlaubt, Force-Push und
  `--no-verify` bleiben gesperrt. Abhängigkeiten dürfen ohne Rückfrage hinzukommen. Begründung:
  Der Agent soll ohne Rückfragen durcharbeiten können. Die Husky-Hooks bleiben die Qualitätssperre.

- **Better Auth-Schema per CLI erzeugt, CLI nicht als Abhängigkeit behalten:** `auth generate`
  schrieb `apps/api/src/db/auth-schema.ts`, die Migration kam danach von drizzle-kit. Die CLI wird
  nur bei einer Änderung der Auth-Plugins gebraucht (`pnpm dlx auth@latest generate` mit einer
  temporären Konfig-Datei und `--output src/db/auth-schema.ts -y`). Ein dauerhafter Eintrag wäre
  für knip eine ungenutzte Abhängigkeit.
- **Dev-Server mit Vite-Proxy, ein Origin:** `BETTER_AUTH_URL` ist der einzige vertraute Origin. Im
  Entwicklungsbetrieb leitet der Vite-Server `/api` an die API weiter, so gibt es kein CORS und
  keine zweite Origin-Liste. Im Betrieb liefert die API das Frontend selbst aus.
- **Keine automatischen Wiederholungen in der Job-Queue:** Der Job löscht die Upload-Bytes am Ende,
  ein Wiederholungsversuch fände sie nicht mehr. Der Nutzer wiederholt eine fehlgeschlagene Quelle
  in der UI (erneuter Upload gleicher Datei geht durch den RETRY-Pfad).
- **Eigener Sliding-Window-Limiter statt bottleneck:** Anfragen und Tokens pro Minute in 60
  Zeilen mit steuerbarer Uhr, deterministisch testbar. bottleneck kennt keine Token-Gewichte pro
  Fenster, ohne zwei Limiter zu verschachteln.
- **Kein liteparse-Fallback im ersten Wurf:** Scheitert Gemini bei einem PDF, wird die Quelle
  FAILED (PARSE_FAILED) und der Nutzer kann es erneut versuchen. Der Fallback wäre ein zweiter
  Parser mit Tesseract-Daten zur Laufzeit; er kommt nur, wenn die Fehlerrate es rechtfertigt.

## 2026-09-30 (Leseansicht und Chat-Verlauf)

- **Der Server speichert den Chat-Verlauf selbst, es gibt keinen Speichern-Endpunkt:** Die Frage wird
  gespeichert, sobald die Antwort startet (abgewiesene Fragen hinterlassen nichts). Die Antwort wird
  kurz vor dem letzten Ereignis gespeichert. Ein Client, der Antworten mit Zitaten selbst speichern
  könnte, könnte den Zitat-Vertrag umgehen. Bricht das Modell mittendrin ab, bleiben die schon
  geprüften Aussagen erhalten; ohne jede Aussage wird nur nach einem regulären Ende gespeichert.
- **Nur Lesen für den Verlauf (`GET /api/notebooks/:id/messages`):** Löschen des Verlaufs kommt erst,
  wenn die Oberfläche es braucht.
- **Reihenfolge über eine Identity-Spalte `seq`:** Zeitstempel allein können bei zwei Zeilen im
  selben Moment gleich sein. Die Aussagen liegen als JSON in der Tabelle und werden beim Lesen mit
  `ChatMessageSchema` geprüft; eine kaputte Zeile wirft, statt übersprungen zu werden.
- **Zitat-Details und Quellentext gelten nur, solange die Quelle im Notizbuch liegt:** Wird die Quelle
  entfernt, liefern beide Endpunkte 404. Die Oberfläche zeigt dann „Quelle entfernt“ statt eines Popups.
