# Gesamtreview (2026-10-02)

Vier lesende Prüfungen (API-Code, Web-App, Tech-Stack und Betrieb, Funktionen und Dateitypen), dazu die
Beobachtungen aus dem Journey-Lauf auf der Live-Seite. Es wurde nichts geändert.

**Status der Gates beim Review:** `pnpm check` grün, `pnpm test` grün (131 Dateien, 1045 Tests).
Nicht gelaufen: `pnpm test:db`, `pnpm e2e`, Semgrep. Nicht geprüft: Screenreader, echte Mobilgeräte.

**Vertrauensgrad:** „bestätigt“ heißt, ich habe die Stelle selbst im Code gelesen. „Gemeldet“ heißt, der
Prüfer hat es im Code gesehen, ich habe es nicht einzeln nachgeprüft. Zeilennummern können abweichen.

## Gesamturteil

Der Stack ist stimmig und die Kernlogik ist sauber: Zitatvertrag, Zugriffsschutz in SQL, SSRF-Schutz und
Fehlerbehandlung sind gut. Es gibt keine Komplexität, die weg müsste (größte Datei 337 Zeilen, jscpd grün).
Die Schwächen liegen an den Rändern: **Zuverlässigkeit im Betrieb** (hängende Quellen, Backups, Monitoring),
**Härtung** (Header, Deploy-Trigger, Ratenbegrenzung) und **Zustand beim Wechsel zwischen Notebooks**.

## Hoch

| #   | Befund                                                                                                                                                                                                                                                                                                                 | Beleg                                                                  | Vertrauen                                 | Fix                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Quellen bleiben nach Absturz oder Deploy für immer in „wird gelesen“. Kein Neuversuch (`NO_RETRIES = 0`), keine SIGTERM-Behandlung, `queue.stop` hat keinen Aufrufer, kein Aufräumen beim Start. Fehler in `uploads.put`, `markProcessing`, `markReady` rufen `fail` nicht auf. Ein erneuter Upload gilt als Duplikat. | `apps/api/src/jobs/queue.ts`, `index.ts` (kein SIGTERM)                | bestätigt                                 | Beim Start hängende Quellen auf FAILED setzen oder neu einreihen; SIGTERM-Handler mit `queue.stop` und `server.close`.                        |
| H2  | Der Zustand der Notebook-Seite bleibt beim Wechsel der Notebook-ID erhalten (offene Quelle, Ausgabe, Notiz, laufende Antwort). Das ist der Fehler mit der 404 aus dem Journey-Lauf. Auslöser: „Notebook kopieren“, Browser-Zurück und -Vor.                                                                            | `App.tsx:15` (ein Route-Element, kein `key`), `use-notebook-layout.ts` | Ursache bestätigt                         | `NotebookPage` mit `key={notebookId}` rendern, Test zuerst.                                                                                   |
| H3  | Der Deploy-Workflow prüft nur `conclusion == 'success'`, nicht `event` oder Head-Repository. Das Repo ist öffentlich (bestätigt). Ein CI-Lauf aus einem Fork könnte so ein Deploy auslösen.                                                                                                                            | `.github/workflows/deploy.yml:9-25`                                    | Bedingung bestätigt, Folge unbelegt       | Bedingung um `github.event.workflow_run.event == 'push'` und gleiches Repository ergänzen; Fork-PR-Freigabe in den Repo-Einstellungen prüfen. |
| H4  | Backup liegt auf demselben Server, 7 Tage, Restore nie getestet, kein Dump vor Migrationen. `server.env` und Objektspeicher fehlen im Backup.                                                                                                                                                                          | `deploy/backup.sh`, `docs/DEPLOYMENT.md`                               | gemeldet                                  | Dump verschlüsselt extern ablegen, einmal Restore proben, vor Deploy mit Schemaänderung einen Dump ziehen.                                    |
| H5  | Kein Monitoring. `/health` liefert immer „ok“ und prüft die Datenbank nicht.                                                                                                                                                                                                                                           | `apps/api/src/app.ts:53`                                               | bestätigt                                 | `SELECT 1` im Health-Check, externer Uptime-Check mit E-Mail.                                                                                 |
| H6  | Mobil kein Weg aus der Quellenansicht: Der Schließen-Button wird als `action` übergeben, der Kopf ist unter 66 rem ausgeblendet, wenn kein `header` gesetzt ist.                                                                                                                                                       | `notebook/panel.tsx:55-66`, `notebook-columns.tsx:49`                  | aus Code abgeleitet, nicht live bestätigt | Button über `header` übergeben oder im Reader rendern; im Browser mit schmaler Breite prüfen.                                                 |
| H7  | CSV-Export ohne Schutz vor Formeln. Zellen mit `=`, `+`, `-`, `@` am Anfang werden unverändert exportiert, der Inhalt stammt aus Modellantworten über Nutzerdokumente.                                                                                                                                                 | `apps/web/src/lib/csv.ts`                                              | bestätigt                                 | Bei diesen Anfangszeichen (auch Tab, CR) ein `'` voranstellen, Test zuerst.                                                                   |

## Mittel

**API und Daten**

- **M1 Wettlauf bei Hash und Kontingent.** `findByHash`, `assertCanCreate`, `create` laufen nicht in einer
  Transaktion. Zwei parallele gleiche Uploads können an der Unique-Bedingung mit 500 scheitern, das
  Kontingent (10 pro 24 h) ist nicht atomar. Fix: `INSERT … ON CONFLICT DO NOTHING RETURNING` und Kontingent
  in einer Transaktion. (gemeldet, `ingestion/submit.ts`, `ingest.ts`)
- **M2 Keine Ratenbegrenzung pro Nutzer** ✅ Chat (30 Fragen pro Stunde) und Studio (20 Ergebnisse pro Stunde)
  haben jetzt ein Limit pro Nutzer. Better Auth hat `rateLimit` in Produktion standardmäßig aktiv (pro IP,
  strenger für Anmelden und Registrieren), damit ist die Registrierung abgedeckt. Upload, Websuche und der
  Gast-Start waren schon begrenzt.
- **M3 Security-Header fehlen.** Der Caddyfile enthält nur `reverse_proxy` (bestätigt). Kein HSTS, CSP,
  `frame-ancestors`, Referrer-Policy. Fix: `header`-Block in Caddy, CSP danach schrittweise.
  CORS/CSRF-Schicht ist nicht geprüft.
- **M4 HNSW-Index mit SQL-Filter.** Weder `hnsw.iterative_scan` noch `ef_search` kommen im Code vor
  (bestätigt per Suche). Bei vielen Nutzern kann der nachgelagerte Filter zu zu wenigen Treffern führen.
  Heute bei kleinen Datenmengen unkritisch. Der Plan mit `EXPLAIN` ist nicht geprüft.
  Fix: `SET LOCAL hnsw.iterative_scan = relaxed_order` pro Abfrage, danach messen.
- **M5 Prompt-Injection nur teilweise abgefangen.** (✅ siehe ENTSCHEIDUNGEN.) Der Zitatvertrag verhindert erfundene Belege, aber
  Quelltext steht ohne Trennzeichen und ohne Regel „Quelltext ist Daten, keine Anweisung“ im Prompt.
  Fix: Trennzeichen und Regel im Systemprompt, ein Testfall mit eingeschleuster Anweisung.
- **M6 Upload-Prüfung lückenhaft.** TXT und MD nur nach Endung; kein Schutz gegen Zip-Bomben in mammoth;
  jede ZIP-Datei als `.docx` besteht die Magic Bytes; `title: file.name` ohne Längenbegrenzung.
  Fix: auf `word/document.xml` prüfen, Titel kürzen.
- **M7 Datenschutz.** (Konto löschen ✅, siehe ENTSCHEIDUNGEN.) Kein Konto-Löschen für registrierte Nutzer, Datenschutzerklärung und Impressum: vom Nutzer als nicht notwendig entschieden.
  Der kostenlose Gemini-Tarif darf Eingaben zur Verbesserung nutzen, und die Oberfläche zeigt das nicht.
  Tavily bekommt die Suchanfragen. Fix: Konto löschen mit Kaskade und Objektspeicher, Hinweis im
  Upload-Dialog, für Echtbetrieb bezahlter Tarif. (gemeldet, rechtlich nicht geprüft)
- **M8 Deploy ohne Absicherung.** Kein Test von außen nach dem Deploy, kein Rollback, `previous` wird beim
  nächsten Lauf überschrieben. Fix: `curl /health` nach dem Start, bei Fehler auf `previous` zurück.
- **M9 Container ohne Grenzen, Images nicht festgelegt.** Nur SeaweedFS hat `mem_limit`.
  `pgvector/pgvector:pg18` ist ein schwimmender Tag, `node:24-slim` ohne Digest. Die tatsächliche
  Serverausstattung ist nicht geprüft. Fix: Limits, `shared_buffers`, feste Versionen.
- **M10 CI und Server-Härtung.** Kein Dependency-Audit und kein Trivy im CI. `pnpm audit` meldet eine moderate Lücke (esbuild über drizzle-kit, nur Dev-Server). Kein fail2ban,
  `deploy` sitzt in der Docker-Gruppe (effektiv root). sslip.io teilt Zertifikatslimits. Fix: Audit im CI,
  fail2ban, eigene Domain.

**Web-App**

- **M11 Antwort-Stream** ✅ (siehe ENTSCHEIDUNGEN). `streamChat` gibt den Reader nicht frei (kein `try/finally`, kein `cancel`), der
  Parameter `signal` wird nie übergeben, es gibt keinen Stopp-Button und keinen Abbruch bei Wechsel oder
  Unmount. Ein Stream ohne `DONE` zählt als Erfolg. Fix: `try/finally`, `AbortController`, Stopp-Button,
  `DONE` als Erfolgsbedingung.
- **M12 Screenreader** ✅ (siehe ENTSCHEIDUNGEN). Der gestreamte Antworttext steht in keiner `aria-live`-Region, nur „Antwort wird
  geschrieben …“ ist `role="status"`.
- **M13 Fokus** ✅ (siehe ENTSCHEIDUNGEN). Das Textfeld ist während der Antwort `disabled`, der Fokus geht verloren. Enter sendet
  ohne `isComposing`-Prüfung (Japanisch und Chinesisch). Fix: `readOnly`, Fokus zurücksetzen.
- **M14 „Erklären“ geht still verloren** ✅ (siehe ENTSCHEIDUNGEN), wenn gerade eine Antwort läuft oder keine Quelle bereit ist
  (`use-incoming-question.ts`).
- **M15 Ausgabe löschen ohne Rückfrage** ✅ (siehe ENTSCHEIDUNGEN), Notizen fragen vorher (`use-studio-actions.ts:68-71`).
- **M16 Bundle** ✅ (siehe ENTSCHEIDUNGEN). Alle Seiten werden eager importiert, Hauptbundle 878 KB unkomprimiert, `written-note` 460 KB.
  Caddy hat kein `encode` (bestätigt), statische Dateien kommen daher unkomprimiert.
  Fix: `lazy()` für die Notebook-Seite, `encode` nur für statische Pfade (der Chat-Stream darf nicht
  gepuffert werden).
- **M17 Tab-Leiste** ✅ (siehe ENTSCHEIDUNGEN). Rohe `<button>` mit 28 px Höhe (zu klein für Touch), keine Tab-Semantik. Der Umbruch
  bei 66 rem lässt Quer-Tablets und kleine Laptops mit einer Spalte.

## Niedrig

- Tippfehler „Notebooksn“ in sichtbarem Text und `aria-label` (bestätigt): `layout/app-header.tsx:32`,
  `notebook/notebook-states.tsx:39`.
- „Prompt“ ist ein Fachbegriff für Nutzer und verletzt Regel 10 (`studio/prompt-chip.tsx`, bestätigt).
- `lib/download.ts`: `revokeObjectURL` direkt nach `click()` kann Downloads abbrechen.
- `use-follow-newest.ts` scrollt immer, auch wenn hochgescrollt wurde.
- `use-sources.ts`: Abfrage alle 2 s ohne Backoff.
- Neues Notebook behält den Titel „Unbenanntes Notebook“ nach dem Upload.
- Kleines drehendes Symbol neben „Antwort wird geschrieben …“: gewollt oder Rest des Spinners? Offen.
- Rohe Controls statt shadcn an einigen Stellen (`quiz-option.tsx`, `studio-tiles.tsx`, `library-row.tsx`),
  nicht einzeln beurteilt.
- SSRF: `BlockList` kennt 6to4 (`2002::/16`) und `192.88.99.0/24` vermutlich nicht.
- Hash über rohe HTML-Bytes: dynamische Seiten dedupen nie. Kein Index auf `(user_id, created_at)` für die
  Kontingentzählung.
- `@types/node` uneinheitlich (Root ^24, Web ^26). `hono` im Web könnte `devDependency` sein.
  `pdf-lib` hat seit November 2021 kein Release mehr, funktioniert aber. Nur Patch-Updates offen.
- Fehlende DB-Isolationsprüfung für das Notebook-Quellen-Repository.

## Doku-Widersprüche

- `docs/PLAN.md` sagt „live seit 2026-10-02“ und an anderer Stelle „auf einem echten Server ungetestet“.
- `docs/PLAN.md` nennt `liteparse` und `bottleneck`; beides gibt es im Code nicht (eigener `RateLimiter`,
  Fallback über `PARSE_FALLBACK_MODEL`). Der Kill-Switch aus dem Plan ist im Code nicht auffindbar.
- `README.md` („Tests entstehen vor dem Code“) widerspricht `AGENTS.md` („the history does not prove the order“).

## Dateitypen

Heute unterstützt: PDF (auch Scans, Gemini liest sie visuell), DOCX, TXT, MD, Webseite, eingefügter Text,
Websuche-Treffer. Grenzen: 10 MB, 50 PDF-Seiten, 5 MB je URL, 10 Quellen pro 24 h.

| Priorität   | Typ                                | Aufwand | Anmerkung                                                      |
| ----------- | ---------------------------------- | ------- | -------------------------------------------------------------- |
| ✅ Erledigt | Bilder und Scans (PNG, JPEG, WEBP) | S bis M | Gemini nimmt Bilder direkt, gleicher Weg wie PDF.              |
| ✅ Erledigt | PDF-Link im URL-Import             | S       | Wird wie ein Upload geprüft (Signatur, Seiten, 10 MB).         |
| Später      | YouTube (Transkript)               | M       | NotebookLM kann es, hoher Nutzwert.                            |
| Später      | Audio (MP3, WAV)                   | M       | Gemini nimmt Audio, Größen- und Kostenfrage.                   |
| Später      | PPTX                               | M       | Häufig in der Praxis.                                          |
| Später      | XLSX und CSV                       | M       | Problem mit `STUDIO_MAX_CHARS` (120k) bei großen Tabellen.     |
| Später      | HTML-Datei                         | S       | Geringer Nutzen.                                               |
| Nie         | EPUB                               | –       | Kaum Nachfrage.                                                |
| Nie         | Google Docs und Slides             | L       | Bewusst offen, siehe [DESIGN-ABGLEICH.md](DESIGN-ABGLEICH.md). |

Fehlerfälle, die heute schlecht erklärt sind: verschlüsseltes oder defektes PDF wird zu „Dateityp nicht
unterstützt“; ein Scan ohne Text wird `EMPTY_TEXT`; eine beliebige ZIP als `.docx` scheitert mit der
allgemeinen Meldung „Die Quelle konnte nicht gelesen werden.“

Was NotebookLM selbst an Quellentypen unterstützt, ist hier nicht gegen die aktuelle Doku geprüft (Regel 12);
vor einer Entscheidung über YouTube, Audio oder Bilder erst dort nachsehen.

## Fehlende Funktionen

1. ✅ **Fehlgeschlagene Quelle neu einlesen.** Die Originaldatei bleibt bis die Quelle bereit ist; "Erneut lesen"
   in der Zeile ruft `POST …/sources/:sourceId/retry` auf.
2. **Export** von Notizen, Chat und Berichten als Markdown ✅ (PDF bewusst nicht, siehe [ENTSCHEIDUNGEN](ENTSCHEIDUNGEN.md)).
3. **Konto und Daten löschen** in der Oberfläche ✅ (siehe M7).
4. Stopp-Button beim Antworten, Rückgängig beim Löschen.
5. Tastaturkürzel, Suche über Inhalte aller Notebooks, Ausgabesprache als Kontoeinstellung.

Bewusst weggelassen: Teilen, Audio- und Videoübersicht, Deep Research, Drive, Daumen-Bewertung.

## Was gut ist

- Zitatvertrag, SQL-Scope pro Nutzer und Notebook, SSRF-Schutz, Fehler werfen statt verschlucken.
- Stack: Hono, Drizzle, pgvector mit hybridem RRF in SQL, pg-boss in Postgres, Better Auth, Vite und React 19,
  TanStack Query. SeaweedFS statt MinIO ist richtig, weil die MinIO-Community-Edition am 25.04.2026
  archiviert wurde (Quelle: Prüfer, nicht selbst nachgeprüft).
- Deploy: Image per SSH ohne Registry, Caddy mit automatischem HTTPS, SHA-gepinnte Actions, Log-Rotation,
  ufw, SSH nur mit Schlüssel, unattended-upgrades.
- Oberfläche: Panels und Gutter mit Tastatur und Fokusverwaltung, Autosave der Notizen, einheitliche
  Lade-, Fehler- und Wiederholungszustände.
- Keine rohen Palettenfarben, keine Begriffe wie RAG oder Embedding in der Oberfläche (außer „Prompt“).

## Nicht geprüft

Hetzner-CX23-Daten und Preis, Drizzle-Versionsstand, Fork-PR-Einstellungen auf GitHub, konkrete
Gemini-Modell-IDs gegen die aktuelle Doku, `EXPLAIN` der Vektorsuche, Better-Auth-Standardlimits, Browser
und Screenreader, `test:db`, `e2e`, Semgrep.

## Empfohlene Reihenfolge

1. ✅ **Fehler mit Test zuerst:** H2 (`key={notebookId}`), H7 (CSV), Tippfehler und „Prompt“.
2. ✅ **Zuverlässigkeit:** H1 (hängende Quellen und SIGTERM), H5 (Health mit DB), M1 (Transaktion).
3. ✅ **Härtung, klein:** H3 (Deploy-Bedingung), M3 (Header in Caddy), H6 nach Browserprüfung.
4. **Betrieb:** M8 und M9 erledigt; H4 teilweise (Dump vor jedem Deploy, Restore-Probe), Kopie auf externen Speicher: vom Nutzer als nicht notwendig entschieden.
5. **Funktionen:** PDF-Link ✅, Bilder ✅; „neu einlesen“ ✅; Markdown-Export ✅; Konto löschen ✅; Hinweis zum Gemini-Tarif im Upload-Dialog: zurückgestellt, solange die Seite eine Demo ist.
6. **Danach:** M5 ✅, M2 ✅, M11 ✅, M12 ✅, M13 ✅, M14 ✅, M15 ✅, M16 ✅, M17 ✅; YouTube, Audio, PPTX.
