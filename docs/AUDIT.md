# Architektur-Audit (2026-10-02)

Ergebnis einer Durchsicht nach Schichten, KI-/Streaming-Robustheit, Redundanz, Typsicherheit und
Lebenszyklus. Entscheidungen im Einzelnen stehen in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md).

## Was geprüft wurde und in Ordnung ist

- **Schichten:** `pnpm depcruise` meldet keine Verstöße; `packages/shared` enthält nur Schemas und Konstanten.
- **Typen an Grenzen:** Jedes `JSON.parse` im Produktivcode läuft direkt in ein Zod-Schema (Modellantworten,
  SSE-Ereignisse im Web, Prompts). Kein `any`, kein `@ts-ignore`, kein `as unknown as`.
- **Anbieter-Entkopplung:** Chat, Embeddings und PDF-Parser sind Ports (`providers.ts`), Modellnamen kommen aus der
  Konfiguration, jeder Aufruf geht durch den Rate Limiter.
- **Zitate:** Vertrag in `packages/shared`, der Server verwirft Zitate außerhalb des Kontexts.

## Die fünf Hebel

| #   | Hebel                                              | Stand                                                                                                                                                                      |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a  | Abbruch: Leser verlässt den Chat                   | Erledigt (`9bea91a`): `stream.onAbort` bricht die Modellanfrage ab.                                                                                                        |
| 1b  | Zeitgrenzen je Versuch                             | Erledigt (`590ad08`): `CHAT_TIMEOUT_MS`, `EMBED_TIMEOUT_MS`, auch für den Antwortkörper.                                                                                   |
| 1c  | Wartezeit bei Wiederholungen                       | Erledigt (`590ad08`): `RETRY_MAX_WAIT_MS` begrenzt `retry-after`, die Wartezeit ist abbrechbar.                                                                            |
| 1d  | Rate Limiter kennt ein Signal                      | Erledigt (`9163e2d`): ein abgebrochener Aufruf verlässt die Warteschlange und verbraucht keine Quote. Chat reicht das Signal durch.                                        |
| 2   | Hintergrundaufträge (Übersicht, Studio) ohne Leser | Kein Hebel: sie haben keinen Leser, der abbricht; die Zeitgrenze der Konfiguration gilt auch dort.                                                                         |
| 3   | Embedder und PDF-Parser ohne Signal                | Offen, klein: Aufträge laufen im Job-Runner (pg-boss) und haben heute keinen Abbruchweg. Erst sinnvoll, wenn Jobs abbrechbar werden (Löschen einer Quelle während Import). |

## Offen, bewusst nicht angefasst

- **Web: Stream wird beim Verlassen der Seite nicht abgebrochen** (`use-chat.ts` übergibt kein Signal). Das ist
  gewollt: der Server speichert die Antwort, beim Zurückkehren ist sie da. Beim Schließen des Tabs bricht der Server
  die Modellanfrage ab (1a).
- **Web: `streamChat` gibt den Reader nicht frei, wenn ein Ereignis das Schema verletzt.** Die Verbindung bleibt bis zum
  Ende der Antwort offen. Geringe Wirkung; ein `try/finally` mit `reader.cancel()` ist ein kleiner Folgeschritt.
- **Hängender Antwortkörper gegen die echte API** ist nicht getestet: MSW reicht den Abbruch nicht an den Körper weiter.
  Das lässt sich nur mit `pnpm eval:live` prüfen.
- **Isolationstest für `notebook-source-repository`** (Nutzer A sieht keine Quellen von Nutzer B) fehlt als eigener
  DB-Test.

## Geprüft und nicht geprüft

Grün: `pnpm check`, `pnpm test`, `pnpm test:db` (271) auf dem Stand von `9163e2d`.

Nicht geprüft: `docker build`, der Deploy-Workflow und die Mindestbreite des Studio-Bereichs im Browser.
