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

## 2026-09-30 (Frontend)

- **Notizbuch löschen ergänzt (`DELETE /api/notebooks/:id`):** Must-Anforderung 1 verlangt Löschen, der
  Endpunkt fehlte. Gelöscht werden das Notizbuch, die Verknüpfungen und der Chat-Verlauf; die Quellen
  bleiben beim Nutzer (sie sind über den Inhalts-Hash dedupliziert und werden bei erneutem Hochladen
  wiederverwendet). Die Oberfläche sagt trotzdem „mit allen Quellen gelöscht“, weil die Quellen ohne
  Notizbuch nicht mehr sichtbar sind.
- **shadcn per Hand eingerichtet:** `shadcn init` fragt interaktiv und hing im Agenten-Lauf. Es gibt
  `components.json` (Stil `new-york`, Tailwind 4, Lucide), die Tokens stehen in `src/index.css`.
  `shadcn add` schreibt `import { cn } from "cn"` und trägt dazu das fremde npm-Paket `cn` ein, weil
  `lib/utils` fehlte. Das Paket wurde entfernt, `cn` liegt in `src/lib/utils.ts` (clsx + tailwind-merge).
  Nach jedem `shadcn add` prüfen, ob `cn` wieder in `apps/web/package.json` auftaucht.
- **Kein `@testing-library/jest-dom`:** Mit Vitest 5 passen die Typen nicht (`Assertion<T, Elem>`), und
  der Import im Setup ließ `rejects.toThrow(/…/)` im Netzwerk-Riegel-Test ins Leere laufen. Die
  Komponententests nutzen einfache Matcher (`toBeTruthy`, `toBeNull`, `toHaveProperty`).
- **Web-Tests teilen die Vite-Konfiguration** (`extends` in `vitest.config.ts`), damit der Alias `@`
  auch in Tests gilt. Knip bekommt die Testdateien von `apps/web` als Einstiegspunkte.
- **`AppType` kommt über `@nlm/api/app`** (`exports` im Paket der API, `import type` im Web). Dafür
  lädt der Typecheck des Webs die Node-Typen mit. Der Hono-Client wird nur zum Aufrufen der JSON-Routen
  genutzt; Datei-Upload und Chat-Stream laufen über `fetch`, weil beide Routen keine JSON-Schemas haben.
  Antworten werden zusätzlich mit den Schemas aus `packages/shared` geprüft.
- **Oberflächenlogik:** Die Leseansicht ersetzt das Quellenpanel links (wie im Referenz-Screenshot), der
  Chat bleibt rechts sichtbar. Zitat-Nummern zählen pro Antwort in der Reihenfolge des ersten
  Auftretens; dieselbe Textstelle behält ihre Nummer. Kein Markdown-Rendering in Antworten (die Aussagen
  sind Sätze); `react-markdown` kommt erst mit dem Studio.
- **Offline-Server (`pnpm --filter @nlm/api dev:offline`):** Die echte App mit Postgres, Sitzungen,
  Parsern, Suche und Zitatprüfung, aber mit Bag-of-Words-Vektoren statt Gemini-Embeddings und einem
  Modell, das den ersten Satz der besten Textstellen zitiert. Dient der Browser-Prüfung und dem
  Playwright-Smoke-Test ohne Kontingent. PDFs schlagen dort bewusst fehl (Parser braucht den Anbieter).
  Er lädt `.env.local` nicht, damit er nie an eine echte Datenbank gerät.
- **`hono` im Web und in der API auf dieselbe Version gehoben:** Zwei Versionen machen den RPC-Typ
  unbrauchbar (`HandlerInterface` inkompatibel).

## 2026-09-30 (Quellenübersicht und Vorschlagsfragen)

- **Eine Übersicht pro Quelle, beim ersten Aufruf erzeugt und gespeichert:** Zusammenfassung,
  Schlüsselthemen und Vorschlagsfragen kommen aus einem einzigen Modellaufruf
  (`GET /api/notebooks/:id/sources/:sourceId/overview`, Spalte `sources.overview`). Das deckt Must 5 und
  die Vorschlagsfragen ab. Lazy statt im Ingestion-Job: Der Job bleibt unverändert und kann nicht an der
  Übersicht scheitern, und der Aufruf kostet nur Kontingent, wenn jemand das Notizbuch wirklich öffnet.
  Nachteil: Die erste Ansicht wartet ein bis zwei Sekunden. Der Demo-Seed erzeugt die Übersichten vorab.
- **Die Übersicht ist immer deutsch,** auch bei englischen Quellen (Oberfläche nur Deutsch, deutsche
  Fragen auf englische Quellen sind im Spike gemessen). Der Text wird bei 45.000 Zeichen gekürzt
  (etwa 15.000 Token) und das im Prompt vermerkt.
- **Vorschläge im leeren Chat:** aus den ersten drei ausgewählten, fertigen Quellen je zwei Fragen,
  höchstens vier. Schlägt die Erzeugung fehl, steht dort ein Hinweis und die Eingabe bleibt frei.

## 2026-09-30 (Notizen)

- **Eine Notiz ist eine Kopie einer gespeicherten Antwort, der Client schickt nur die Nachrichten-ID:**
  `POST /api/notebooks/:id/notes` mit `{ messageId }` kopiert die Aussagen samt Zitaten in SQL aus
  `chat_messages`. Ein Client kann so keine Zitate einschmuggeln, die der Server nicht geprüft hat
  (Invariante 1). Dieselbe Antwort zweimal zu speichern ergibt dieselbe Notiz (`message_id` ist
  eindeutig). Freitext-Notizen gibt es bewusst nicht; sie wären ohne Zitate und ohne Prüfung. _(Überholt am
  2026-10-01: siehe „Notizen mit Editor“ unten. Gespeicherte Antworten bleiben, wie hier beschrieben.)_
- **Notizen links neben den Quellen (Tabs „Quellen“ / „Notizen“):** Die Leseansicht ersetzt weiterhin das
  ganze linke Panel, damit ein Klick auf ein Zitat in einer Notiz dieselbe Ansicht öffnet wie im Chat.

## 2026-09-30 (Auswertung, Seed, Deployment)

- **`pnpm eval:live` nutzt den echten Weg:** Es liest das Spike-Korpus mit der echten Aufnahme in ein
  Notizbuch eines Wegwerf-Nutzers (`eval-user`), stellt die Fragen über denselben Code wie der Chat und
  bewertet mit den vorhandenen Scorern. Bekannter Inhalt wird wiederverwendet, nur der erste Lauf zahlt
  für Parsing und Einbettung. Die Ergebnisse (auch die Antworten) landen in `reports/`, das Git ignoriert.
  Weil der Server Aussagen ohne gültiges Zitat entfernt, ist die Zitat-Gültigkeit der Ausgabe immer
  100 %. Aussagekräftig sind darum die Zahlen der verworfenen Aussagen und entfernten Zitate.
- **Demo-Seed mit eigenen Texten:** Drei kurze Dokumente in `apps/api/seed/demo` (ein erfundener
  Projektbericht, DSGVO-Grundlagen in eigenen Worten, eine englische RAG-Übersicht). Keine Fremdtexte,
  damit das Repository sie mitliefern darf. Die Übersichten entstehen im Seed, sodass der erste Besuch
  keine Modellaufrufe für sie braucht. Das Demo-Konto kommt aus `SEED_DEMO_EMAIL` und
  `SEED_DEMO_PASSWORD`; Better Auth legt es an, das Skript kennt keine Passwort-Hashes.
- **Ein Bundle, ein Container:** `esbuild` bündelt die API in eine Datei. Zwei Fehler, die erst der
  Start des Bundles zeigte: ein `createRequire`-Banner fehlte (`pg` nutzt `require`), und der Pfad der
  Migrationen war nur für `src/db` richtig (`migrations-folder.ts` sucht jetzt an beiden Orten). Der
  CLI-Teil von `migrate.ts` lief im Bundle als Nebenwirkung mit und liegt jetzt in `migrate-cli.ts`.
- **Render (Blueprint) und Neon:** `render.yaml` beschreibt einen kostenlosen Docker-Dienst in Frankfurt.
  Die Schlüssel werden im Dashboard eingetragen (`sync: false`), `BETTER_AUTH_SECRET` erzeugt Render.
  Das Image wurde lokal gebaut und gegen die Test-Datenbank gestartet (Health, Frontend, geschützte
  API). Auf Render selbst wurde es noch nicht ausgeführt.
- **Browser-Tests mit Offline-Server, nicht mit Vite:** `pnpm e2e` baut das Frontend und lässt die API es
  ausliefern. Das ist der Weg, den auch der Container geht, und braucht nur einen Port. Der Server wird
  mit `exec node --import tsx` gestartet, damit Playwright ihn beim Beenden wirklich erreicht (mit
  `pnpm` und `tsx` dazwischen hing der Lauf).
- **Zweites Lesemodell nur bei RECITATION:** Der erste Live-Lauf zeigte: `gemini-3.1-flash-lite` bricht
  den gescannten NIST-Text (`05-nist-ai-rmf-scan-en.pdf`) sofort mit `finishReason: RECITATION` und 0
  Zeichen ab, obwohl der Spike ihn noch gelesen hatte. Reproduzierbar (mehrere Läufe), unabhängig von
  Prompt und Temperatur (vier Varianten geprüft). `gemini-3.5-flash` las denselben Scan vollständig
  (8119 Zeichen, Referenz 7890), braucht aber 30 bis 60 s statt 7 s. Deshalb ist `PARSE_FALLBACK_MODEL`
  eine optionale Umgebungsvariable: Nur bei RECITATION wird das PDF mit diesem Modell noch einmal gelesen,
  jeder andere Abbruch bleibt ein Fehler. Ohne die Variable schlägt ein solches PDF wie bisher fehl.
  Einmalige 503-Antworten der API fängt der vorhandene Wiederholungsmechanismus ab.
- **Abgebrochene Skriptläufe werden fortgesetzt:** `importLocalFiles` verarbeitet eine vorhandene Quelle,
  deren Upload noch gespeichert ist. Vorher blieb sie nach einem abgebrochenen Lauf für immer PENDING,
  und `pnpm eval:live` maß mit fünf von sieben Dokumenten weniger (44 % Trefferquote).
- **RECITATION ist bei dem NIST-Scan kein Zufall, sondern eine Grenze:** Sechs Wiederholungen mit
  `gemini-3.5-flash` ergaben dreimal RECITATION, einmal Erfolg und zweimal 503. Die Blockade hängt vom
  Modell und vom Dokument ab, nicht vom Prompt. Ein Wiederholen bis zum Erfolg wäre langsam (20 bis 80 s
  je Versuch) und unzuverlässig, deshalb wird nicht wiederholt. Stattdessen nimmt `pnpm eval:live` eine
  nicht lesbare Datei aus der Wertung und nennt sie im Bericht; ihre Fragen zählen nicht als Fehlgriff der
  Suche. Im Produkt erscheint so ein Dokument als "fehlgeschlagen" und lässt sich erneut hochladen.
- **Zeitlimit beim Lesen von PDFs (120 s je Modellaufruf):** Im Live-Lauf hing ein Aufruf 5 min 40 s und
  endete erst mit dem Standard-Limit der HTTP-Bibliothek (`headers timeout after 300000`). Jetzt bricht der
  Parser nach `LIMITS.PARSE_TIMEOUT_MS` ab; der Import gilt dann als fehlgeschlagen und lässt sich erneut
  versuchen. Gemessen wurden bis zu 79 s für den Scan mit `gemini-3.5-flash`, 120 s lässt Luft.
- **Gleichwertige Schreibweisen bei Pflichtfakten der Auswertung:** Ein Eintrag in `requiredFacts` darf eine
  Liste sein, von der eine Schreibweise genügt. Anlass: Die Quelle nennt "46,2 Millionen" im Text und
  "46 185" (Tausend) in der Tabelle, die richtige Antwort "46,185 Millionen" wurde mit 0 % bewertet.
- **Studio: ein Modellaufruf je Ausgabe, Zitate wie im Chat.** Bericht (Briefing, FAQ, Lernleitfaden),
  Karteikarten, Quiz und Mindmap stehen in `packages/shared/src/studio.ts`. Der Server gibt dem Modell die
  Abschnitte der gewählten, fertigen Quellen in Lesereihenfolge (höchstens `LIMITS.STUDIO_MAX_CHARS`, das
  Budget teilen sich die Quellen gleich, der Anfang jeder Quelle bleibt) mit Kurznamen `c1`, `c2`, …
  Ausgabeteile ohne gültiges Zitat fallen weg, bleibt nichts übrig, antwortet die API mit 422
  (`STUDIO_EMPTY`). Die Mindmap hat feste drei Ebenen statt eines rekursiven Typs, weil die Anbieter
  keine rekursiven Schemas annehmen. Die Ausgaben stehen in `studio_outputs`; Erzeugen ist ein normaler
  Aufruf (5 bis 20 s), kein Stream.
- **Chat-Einstellungen pro Notizbuch** (`notebooks.chat_config`, null = Standard): Stil, Länge, Sprache.
  Die eigene Anweisung des Nutzers steht im Systemprompt hinter den Regeln, die die Zitate sichern. Sie kann
  sie nicht aufheben, denn der Server prüft jedes Zitat unabhängig vom Prompt.
- **Nachbau-Oberfläche (erste Fassung, die Farben und Breiten sind überholt, siehe den Eintrag
  „Nachbau-Oberfläche an NotebookLM gemessen“):** Dreispaltig (Quellen | Chat | Studio) auf hellblauem Grund mit weißen, stark
  gerundeten Flächen, Pillen-Buttons, Google Sans Flex (OFL, über Fontsource) und den Blautönen von Material 3.
  Hell und Dunkel folgen dem System (`lib/theme.ts`). Die Werte sind aus dem Gedächtnis der Google-Palette
  übernommen, nicht aus NotebookLM ausgelesen (belegt ist nur der dreispaltige Aufbau). Unter der Breite von
  `lg` zeigt eine Leiste unten einen Bereich nach dem anderen. Icons bleiben Lucide (Google nutzt Material
  Symbols). Das Logo ist eine eigene Zeichnung (`components/brand/logo.tsx`), die das Original ersetzen
  kann; auf Anmeldung und Notizbuchliste steht, dass es ein Nachbau ist (`lib/notice.ts`).
- **Notizen wohnen im Studio**, nicht in einem eigenen Reiter. Quellen werden über einen Dialog hinzugefügt
  (Datei, Webseite, kopierter Text). Kopierter Text wird als `.txt` hochgeladen: kein neuer Endpunkt.
- **`pnpm eval:studio` (Live-Prüfung des Studios, 2026-09-30):** Mit dem Lite-Modell aus der Umgebung und den
  drei Demo-Texten kamen Bericht, Karteikarten, Quiz und Mindmap in 4 bis 6 s zurück. Der Anbieter nahm
  alle vier Schemas an, der Server verwarf keinen Teil. Das Beispiel ist klein (6 Abschnitte Kontext); wie
  sich große Quellen verhalten, ist nicht gemessen.
- **Nachbau-Oberfläche an NotebookLM gemessen (2026-09-30):** Die Werte stammen jetzt aus dem echten Produkt
  (berechnete Stile und Token des offenen Test-Notizbuchs bei 1440x900 und 390x844, hell und dunkel; Rohdaten
  und Screenshots liegen lokal in `spikes/reference/`, sie sind nicht im Repo). Wichtigste Folgen:
  die Palette ist neutral grau statt blau (Seite #faf9f9 / #0f0f0f, Flächen #fff / #1f1f1f, innen #f2f0f0 /
  #171717), Blau nur als Akzent für Fokus und Links (#4259ff / #a1c9ff); Panels haben 32 px Radius, Dialoge 28,
  Menüs 20, die Sprechblase 40; UI-Text ist 15/20 mit Schriftbreite 92 %, Lesetext 16/24 (`font-stretch`,
  Gewichte 370 und 470); Hover ist eine 8-%-Schicht der Textfarbe (`veil`), der Fokus ein 3-px-Ring.
  Spalten sind 24,58 % / Rest / 24,58 % der Fensterbreite, ab 1056 px (`wide`) dreispaltig, darunter ein
  Segment-Schalter oben (nicht mehr unten). Öffnet man eine Studio-Ausgabe, wächst das Studio auf 37,5 % und
  die Quellen schrumpfen auf 20,6 %. Der Chat hat keine Karte mehr.
- **Was bewusst vom Original abweicht:** (1) Der Name bleibt „NotebookLM (Nachbau)“, obwohl das Produkt heute
  „Gemini Notebook“ heißt; die Freigabe des Nutzers nannte NotebookLM, und ein Nachbau mit dem alten Namen
  ist für die Bewerbung eindeutiger. (2) Die Spaltenbreite ist nicht ziehbar (kein Trenner), das wäre Aufwand
  für wenig Wirkung. (3) Kein Dialog für Karteikarten, Quiz und Mindmap: das Backend kennt dafür keine
  Parameter (Anzahl, Schwierigkeit, Thema); nur der Bericht fragt nach der Vorlage. (4) Notizen sind
  zuerst gespeicherte Antworten gewesen (ohne „Notiz hinzufügen“); seit 2026-10-01 gibt es auch freie Notizen
  mit Editor, siehe „Notizen mit Editor“ unten. (5) Kein „ungelesen“-Punkt an Ausgaben (würde einen Lesestatus pro Ausgabe brauchen). (6) Die
  Notizbuchliste zeigt auf dem Handy Karten statt Zeilen. (7) Die Tabs der Mobilansicht heißen deutsch
  „Quellen | Chat | Studio“; das Original hat dort englische Reste. (8) Die Farben der Mindmap-Knoten im
  Dunkelmodus sind geschätzt (die Mindmap läuft im Original in einem Iframe und ließ sich nicht messen).
- **Startseite des Originals:** Auf Wunsch des Nutzers zusätzlich gemessen. Die Liste folgt ihr: Karten
  272x185 mit Radius 40 und 32 px Innenabstand, Abschnittstitel 24/32, die blaue Pille „Neues Notizbuch“
  (hell #9dd2ff, dunkel #1f3b9b) öffnet einen Dialog für den Titel, statt ein Formular auf der Seite zu zeigen.
  Löschen sitzt im ⋮-Menü der Karte. Die „Empfohlenen Notebooks“ sind Googles eigene Inhalte und fehlen.
- **Abgleich mit dem Original, Runde 2 (2026-09-30):** Plan und Checkliste stehen in
  [DESIGN-ABGLEICH.md](DESIGN-ABGLEICH.md). Erste Ergebnisse: (1) Die Spalten folgen der Regel des Originals
  (`flex 0 1 25 % / 48 % / 25 %` in einem Container aus Fensterbreite minus 24 px, Trenner 8 px; der Rest von 2 %
  bleibt rechts frei; mit offener Studio-Ausgabe 10 : 19 : 37,5 vw), Panels haben 1 px unsichtbaren Rahmen und
  12 px Abstand unten, der Chat reicht bis zum Fensterrand, die Eingabe ist 628 px breit. Die Werte stimmen mit dem
  Original auf die Nachkommastelle überein. (2) **Zeiger und Tooltips:** Tailwind v4 setzt Buttons auf den Pfeil;
  eine Basisregel gibt allen nutzbaren Bedienelementen die Hand. Der Tooltip ist der des Originals (Inverse-Fläche,
  ohne Verzögerung, 8 px unter dem Element). (3) **`cn()` kannte die eigenen Schriftgrößen nicht** und warf
  `text-small` neben einer Textfarbe still weg; behoben, mit Test. (4) **Quellen werden formatiert gezeigt:** Der
  Text einer Quelle ist Markdown (PDF vom Modell, Web und DOCX vom Wandler), nur TXT bleibt Klartext. Der Wandler
  schreibt jetzt Links (nur http/https, relative über `<base>`, kanonischen Link oder `og:url` der Seite
  aufgelöst, sonst nur Text), Fett, Kursiv, Code, Zitate und echte Tabellen. Dafür landen URLs im Chunk-Text
  (bei linkreichen Seiten wenige Prozent mehr). **Bestehende Quellen werden nicht neu geparst**; sie zeigen, was
  sie hatten (Überschriften, Listen), Links erst nach erneutem Hinzufügen. Die Zitat-Markierung nutzt die
  Positionen des Markdown-Parsers und liegt auch in Fett und Links; wo Markdown Zeichen verändert hat (Escapes),
  wird das ganze Textstück markiert statt eines falschen Teils. (5) **Quellenübersicht** wohnt wie im Original im
  Reader (Karte mit Einklapp-Pfeil), nicht mehr als Ausklapper in jeder Zeile. Das Chunk-Detail trägt die
  Quellenart, damit das Popup TXT als Klartext zeigt.
- **Ladezustände wie im Original (2026-10-01):** Platzhalter schimmern (Verlauf 90°, Band bei 25 / 37 / 63 %,
  400 % breit, 1,4 s; bei „weniger Bewegung“ stehen sie still) statt zu pulsieren, und sie haben die Form des späteren
  Inhalts: Quellenzeilen, sieben Chat-Balken mit Spinner, fünf Studio-Zeilen auf dem Blau der Quellenkarte,
  Kartenraster auf der Startseite. Die Notizbuchseite bleibt dreispaltig, nur der Titel zeigt einen Balken. Die
  Farben im Dunkelmodus sind eigene Werte: das Original nutzt dort eine grelle Lichtkante (#d4d7db), die auf
  dunklem Grund störte. `QueryBoundary` verlangt jetzt eine `loading`-Angabe, damit keine Stelle einen
  unpassenden Standard-Platzhalter bekommt.
- **Kopfzeile wie im Original (2026-10-01):** Rechts „+ Notizbuch erstellen“ (legt ein Notizbuch an und öffnet es),
  ⋮ (Chat konfigurieren, Chatverlauf löschen mit Hinweis, Notizbuch löschen, die beiden Löschungen mit
  Rückfrage) und ⚙ (Darstellung: Gerätestandard / Hell / Dunkel; die Wahl steht in einem Cookie, weil
  `localStorage` bei gesperrtem Speicher wirft und die Regeln stilles Fangen ausschließen). Der Titel ist wie im
  Original ein Eingabefeld (22/36): Verlassen oder Enter speichert, Escape verwirft. Dafür gibt es zwei neue
  Endpunkte, `PATCH /api/notebooks/:id` (Titel) und `DELETE /api/notebooks/:id/messages` (Chatverlauf), beide
  auf den eigenen Nutzer begrenzt. Bewusst nicht übernommen: „Freigeben“, „PRO“, Apps-Raster, „Notebook
  anpassen/kopieren“, „Analysen“, Hilfe, Discord, Abo, Wasserzeichen, Lizenzen (Google-Kontext oder keine Funktion
  bei uns). Menüs öffnen ohne Abstand unter dem Auslöser (im Original y = Unterkante des Buttons).
- **Studio-Liste wie im Original (2026-10-01):** Gespeicherte Antworten sind Zeilen derselben Liste wie die Ausgaben
  (nach Zeit sortiert, neueste oben) und öffnen sich in derselben Art von Ansicht („Studio › Notiz“ mit
  Löschen-Knopf und „Als Quelle festlegen“ unten); der Abschnitt „Notizen“ mit Karten entfällt. Ansichten für
  Ausgaben und Notizen teilen sich den Rahmen (`ViewerFrame`). Während etwas erzeugt wird, zeigt die Liste eine
  schimmernde Zeile mit Spinner und „basierend auf n Quellen“. Die leere Liste sagt „Hier wird die Ausgabe von
  Studio gespeichert.“ Der Senden-Pfeil ist bei leerem Feld deaktiviert und grau; unter der Antwort stehen
  „In Notiz speichern“ und Kopieren als Icon; die Kachel heißt „Berichte“; Quellen haben ein Symbol nach Dateityp
  (PDF rot). „Notiz hinzufügen“ kam später dazu (2026-10-01, siehe „Notizen mit Editor“ unten).
- **Startseite wie im Original (2026-10-01):** Kopfzeile mit Wortmarke, Suchpille („Notizbücher durchsuchen“,
  256x36, filtert die geladene Liste im Browser) und ⚙; die Karten tragen ein Emoji (aus der ID abgeleitet, damit es
  je Notizbuch gleich bleibt; das Original wählt eines pro Notizbuch), das Datum als TT.MM.JJJJ und die Zahl der
  Quellen. Die Zahl zählt die Datenbank (`sourceCount` im Vertrag, ein Unterabfrage-Zähler je Notizbuch). Der
  Einleitungstext entfällt, er steht nicht im Original. Nicht übernommen: Filter-Tabs „Alle / Entdecken /
  Sammlungen“, der Umschalter Raster/Liste, „Empfohlene Notebooks“ (Googles Inhalte).
- **Textfarben wie im Original (2026-10-01):** Gemessen sind drei Töne: UI-Text (hell #000, dunkel #e6e6e6), der
  Fließtext im Chat (#303030 / #c7c7c7, Token `--body`), der Text einer Quelle (#1b1b1c / #f2f2f2, `--doc`) und
  das Kleingedruckte wie Uhrzeit und Zitat-Zahl (#5e5e5e / #ababab, `--meta`). Über jeder Frage steht wie im
  Original „Heute • 20:51“ (gestern, sonst das Datum).
- **Fette Begriffe in Antworten (2026-10-01):** Das Original hebt Schlüsselbegriffe fett hervor. Der Prompt erlaubt dem
  Modell `**fett**` (sonst kein Markdown), die Oberfläche zeigt fett, kursiv und Code in einer Aussage und lässt
  alles andere Text (keine Überschrift, Liste oder Link aus Modellausgabe). Beim Kopieren und bei „Als Quelle
  festlegen“ fallen die Sternchen weg. Der Zitatvertrag ist unberührt: der Server prüft jede Belegnummer wie
  zuvor. Listen wie im Original gibt es bewusst nicht: unsere Aussagen bilden fließenden Text, eine Liste würde
  sie falsch gliedern. Live geprüft: 9 fette Begriffe in einer Antwort zu einem Wikipedia-Artikel, alle Belege
  gültig.

## 2026-10-01 (Abgleich, Runde 3)

- **Spalten klappen ohne Sprung, nach dem Mechanismus des Originals (2026-10-01):** Das Original wurde Bild für Bild
  gemessen (Breite der drei Spalten je Frame beim Einklappen, Ausklappen, Öffnen und Schließen einer Ausgabe). Es
  animiert nur Längen: die schmale Leiste über `inline-size` (0,2 s ease-in-out), die breite Studio-Ansicht über
  `min-inline-size` (0 → 37,5 vw) am Studio; die anderen Spalten geben per normalem Flex-Schrumpfen nach (Quellen 296,5,
  Chat 563,5 bei 1440 px, das ist exakt die Rechnung aus `flex-shrink` mal innerer Basisgröße). Unsere erste Fassung
  wechselte beim Chat zwischen `0 1 48 %` und `1 1 0 %` (`flex-grow` und `flex-basis` wurden gleichzeitig überblendet),
  schaltete den Rand `ml-2` sofort um und tauschte den Inhalt des Panels gegen eine Leiste aus. Messung der alten
  Fassung: das Studio wanderte beim Einklappen von x = 1070 auf 832 und wieder auf 1074, der Chat schrumpfte dabei kurz
  um 100 px. Jetzt füllt der Chat immer (`flex 1 1 48 %`, `max-width: 48 %` solange beide Seiten offen sind, sonst 100 %),
  die Seitenspalten wechseln zwischen `0 1 25 %` und `0 0 56 px`, und alles läuft als Übergang auf `flex-basis`,
  `min-width`, `max-width` und `margin` mit 0,2 s. Das Original klappt nur ein weich, beim Ausklappen springt es;
  wir sind hier bewusst besser, weil der Sprung das war, was als „kaputt“ auffiel. Die Frame-Messung des Nachbaus
  steht in den Tests nicht (jsdom hat kein Layout), sie ist in `docs/DESIGN-ABGLEICH.md` festgehalten.
- **Inhalt und Leiste bleiben beide im Dokument und blenden ineinander über:** Eine zugeklappte Spalte hat jetzt dieselbe
  Struktur wie eine offene (`inert` und `aria-hidden` auf der jeweils verborgenen Seite). Dadurch ruckt nichts beim
  Wechsel, und ein geöffneter Eintrag oder eine halb geschriebene Frage geht beim Einklappen nicht verloren. Die Leiste zeigt
  wie das Original unter dem Öffnen-Knopf ein Plus und je ein Symbol pro Quelle (Klick öffnet die Quelle und die Spalte),
  im Studio die Kacheln und die Ausgaben als Symbole. Unter 1056 px (Tab-Layout) gibt es keine Leiste
  (`useWideLayout`), sonst wäre eine zugeklappte Spalte nach dem Verkleinern des Fensters unbedienbar.
- **Pfad und Schließen-Knopf der Studio-Ansicht stehen in der Kopfzeile der Spalte:** Vorher schob ein Negativrand
  (`-mt-10`) den Pfad „Studio › Notiz“ über die Kopfzeile, und der Einklapp-Knopf rutschte darunter (Überdeckung). Wie im Original
  steht der Pfad links in der Kopfzeile und rechts ersetzt „Notizansicht schließen“ den Einklapp-Knopf.
  `StudioPanel` trägt dafür sein Panel selbst.
- **Der Inhaltswechsel im Studio ist ein React-Übergang, die Breite wird sofort gemeldet:** Das Rendern einer Ansicht
  dauert im Entwicklungsmodus rund 90 ms und fraß die erste Hälfte der Breitenanimation (CSS-Übergänge starten zum Zeitpunkt
  des letzten Frames). Chat und Quellen sind `memo` mit stabilen Funktionen, `onViewingChange` wird im Klick gerufen
  und der Inhalt folgt per `startTransition`.
- **Reihenfolge der Kacheln wie im Original:** Mindmap, Berichte, Karteikarten, Quiz (die Reihenfolge der vier Formate,
  die wir haben). Vorher stand Bericht zuerst.
- **Vorschlagsfragen unter der letzten Antwort (2026-10-01):** Das Original zeigt unter der letzten Antwort drei Karten
  mit Fragen, die man als Nächstes stellen könnte (gemessen: Fläche `surface-dim`, Radius 24, Innenabstand 20, 14/24,
  Abstand 12, gleich breit, Pfeil unten links, Klick stellt die Frage). Die Fragen kommen **aus derselben Modellantwort**
  (`followUps` hinter den Aussagen), nicht aus einem zweiten Aufruf: das kostet kein zusätzliches Kontingent (Free Tier:
  15 Anfragen pro Minute), und die Aussagen bleiben das Erste, was gestreamt wird. Vertrag: `ChatReplySchema` in
  `packages/shared/src/chat.ts` (höchstens 3, kein Zitat, weil es Fragen sind und keine Behauptungen). Der Server räumt auf
  (`core/follow-ups.ts`: nicht die eben gestellte Frage, keine doppelten, höchstens drei) und liefert nichts, wenn keine
  Aussage einen gültigen Beleg behielt. Sie stehen im Abschlussereignis `ANSWER_DONE` und werden mit der Antwort gespeichert
  (`chat_messages.follow_ups`, Migration `0008`), damit sie nach dem Neuladen noch da sind; ältere Antworten haben keine. Die
  Karten erscheinen nur unter der letzten Nachricht und nur, wenn sie eine Antwort ist. Ohne fertige Quelle sind sie gesperrt.
  `pnpm eval:live` wurde nach dem längeren Prompt nicht neu ausgeführt.
- **Studio-Aktionen fragen vorher, wie das Original (2026-10-01):** Jede Kachel öffnet einen Dialog (gemessen am echten
  Notizbuch: 894 px breit, Radius 28, runder Schließen-Knopf, Fuß mit Trennlinie und „Generieren“). Karteikarten und Quiz
  fragen nach Umfang (Weniger / Standard / Mehr) und Schwierigkeit (Einfach / Mittel / Schwierig), alle vier nach den Quellen
  (Auswahl unter den ausgewählten, fertigen Quellen) und nach einem Thema, der Bericht zusätzlich nach der Vorlage. Der Vertrag
  (`CreateStudioBodySchema`) trägt `size`, `difficulty`, `sourceIds` und `focus`; der Server prüft die Quellenauswahl wie jede
  Abfrage in SQL (nur eigene, ausgewählte, fertige Quellen des Notizbuchs, Fremdes wird ignoriert, Retrieval-Scope bleibt
  gewahrt). Der Umfang steuert die Zahl (Karten 6–8 / 10–15 / 18–25, Fragen 4–5 / 8–10 / 14–18), die Schwierigkeit einen
  Satz im Prompt, das Thema steht **hinter** den Regeln für die Zitate und kann sie nicht aufheben.
- **Berichtsvorlagen:** Eigenen Bericht erstellen (der Text ist die Anweisung, Pflicht), Überblick (früher Briefing), Lernplan
  (Fragen mit kurzen Antworten, Essay-Fragen, Glossar), Blogpost und Häufige Fragen. „Format: Interaktiv / Dokument“ und
  „Vorgeschlagene Vorlage“ gibt es nicht (wir haben keine interaktiven Berichte, und vorgeschlagene Vorlagen bräuchten einen
  weiteren Modellaufruf je Dialog). Die Vorlage ist beim Öffnen nicht gewählt, „Generieren“ bleibt grau, bis sie es ist.
- **Quiz mit Tipp und einer Begründung je Antwort:** Das Original zeigt nach der Antwort bei jeder Option, warum sie stimmt
  oder nicht, und bietet einen Tipp an. Die Modellantwort liefert dafür `hint` und `rationales` (vier Sätze in der
  Reihenfolge der Optionen). Gespeicherte Quizze von vorher haben beides nicht (die Felder sind im gespeicherten Schema
  optional), die Ansicht zeigt dann wie bisher die eine Erklärung. Karteikarten und Quiz bekommen ihren Titel vom Modell
  („Jev Lernkarten“ statt „Karteikarten“).
- **Wie eine Ausgabe entstand, bleibt bei ihr (`request`):** Der Prompt in Worten (deutsch, wie ihn der Leser geschrieben haben
  könnte) und die Titel der verwendeten Quellen, für „Prompt und n Quellen ansehen“. Die Titel stehen als Abdruck da, die Quelle kann später
  fehlen. Ausgaben von vorher haben das nicht und zeigen keine Quellenzahl in der Zeile.
- **Ausgaben werden nicht von selbst geöffnet, sie haben einen blauen Punkt:** Wie im Original landet das Ergebnis mit „n Quellen ·
  Gerade eben“ in der Liste, ein Punkt steht, bis man es öffnet (`unread`, Standard `false`, damit bestehende Ausgaben
  keinen Punkt bekommen und keine Datenmigration nötig ist). Außerdem lassen sich Titel (umbenennen), Bewertung und der
  Lesestatus per `PATCH /api/notebooks/:id/studio/:outputId` ändern.
- **Ansichten der Studio-Ausgaben wie im Original (2026-10-01):** Der Rahmen hat einen bearbeitbaren Titel (Umbenennen per
  `PATCH`), den Chip „Prompt und n Quellen ansehen“ (bei Berichten mit Prompt, sonst nur die Quellen, wie im Original), bei
  Berichten „Inhalt mit Formatierung kopieren“ (HTML und Klartext), bei Karteikarten, Quiz und Mindmap „Maximieren“ (Dialog)
  und unten „Guter / Schlechter Bericht bzw. Inhalt“ (die Bewertung wird gespeichert, ein zweiter Klick nimmt sie zurück).
  Der Titel-Editor ist als `EditableTitle` herausgezogen (dritte Verwendung nach Notizbuch und Ausgabe), ebenso `CopyButton`.
  Nicht übernommen: Teilen (kein Teilen im Umfang), Karten hinzufügen, bearbeiten oder löschen, Stoppuhr, die Fragetypen des
  Quiz (nur Multiple Choice), gespeicherter Fortschritt (Zähler und Position leben nur in der geöffneten Ansicht).
- **Karteikarten:** dunkle Karte auf dunkler Bühne in beiden Themes (eigene Farbmarken für ✗ und ✓), Zähler „n von N“, ein Klick
  dreht, die Rundknöpfe gehen zurück, markieren „nicht verstanden“ / „verstanden“ (beide gehen zur nächsten Karte weiter) und
  vor. Das ⋮-Menü startet neu, mischt oder lädt das Set als CSV. „Erklären“ stellt dem Chat eine Frage zur Karte (`onAsk`, im
  Chat als normale Frage, nur wenn dort gerade nichts geschrieben wird). Die Belege bleiben als Chips unter der Karte.
- **Quiz:** Optionen mit Buchstaben, nach der Wahl sagt jede Option, warum sie stimmt oder nicht („Nicht ganz“, „Richtige
  Antwort“); ältere Quizze ohne Begründungen zeigen die eine Erklärung. „Tipp anzeigen“ vor der Antwort, „Weiter“ springt auch ohne
  Antwort weiter (zählt dann nicht), am Ende „Ergebnis anzeigen“.
- **Mindmap:** Layout als reine Funktion (`lib/mindmap-layout.ts`): eine Spalte je Ebene, Geschwister gestapelt, der Elternknoten
  mittig zwischen erstem und letztem Kind. Die Knotenbreite wird aus den Buchstaben geschätzt, weil das Layout vor dem Zeichnen
  feststehen muss (das Original misst im Browser). Wurzel und Äste sind offen, tiefere Ebenen zu; ein runder Schalter
  nach jedem Knoten klappt auf und zu, „Alle Knoten aufklappen“ öffnet alles und passt es ins Fenster, dazu Zoom, Ziehen und
  Download als PNG (SVG über Canvas, die Schrift ist dort die Standardschrift). Jeder Knoten behält seine Beleg-Chips.

## 2026-10-01 (Notizen mit Editor)

- **Freie Notizen gibt es jetzt, gespeicherte Antworten bleiben unveränderlich:** Eine Notiz hat eine Art (`kind`).
  `ANSWER` ist eine gespeicherte Antwort: Aussagen mit den vom Server geprüften Zitaten, vom Server aus der Antwort
  kopiert; ihr Text ist nicht bearbeitbar, nur ihr Titel. Würde man ihn ändern, bürgte ein Zitat-Chip für Worte, die
  nicht mehr dastehen (Invariante 1). `WRITTEN` ist der Text des Lesers, ein freier Text ohne Zitate; Invariante 1
  betrifft Antworten und gilt hier nicht. Das ersetzt den Beschluss vom 2026-09-30 „Freitext-Notizen gibt es bewusst
  nicht“, weil der Nutzer den Editor wie im Original ausdrücklich wollte.
- **Vertrag und Datenbank:** `NoteSchema` ist eine Union nach `kind` (`packages/shared/src/note.ts`). `POST
/api/notebooks/:id/notes` nimmt `{ kind: ANSWER, messageId }` oder `{ kind: WRITTEN }` (eine leere Notiz).
  `PATCH /api/notebooks/:id/notes/:noteId` ändert den Titel (jede Notiz) und den Text (nur `WRITTEN`, sonst 404); der
  Client kann keine Aussagen oder Zitate schicken. Grenzen in `NOTE_LIMITS` (Titel 200, Text 100.000 Zeichen).
  Migration 0010 fügt `kind` (Standard `ANSWER`, bestehende Notizen bleiben Antworten), `title` und `body` hinzu. Eine
  freie Notiz wird in einer einzigen SQL-Anweisung gegen das Notizbuch des Nutzers angelegt (Invariante 3), jede
  Änderung filtert nach Nutzer und Notizbuch.
- **Der Editor speichert Markdown, nicht Tiptap-JSON:** `@tiptap/markdown` (`getMarkdown()`, `contentType: 'markdown'`).
  So ist die Notiz einfacher Text in der Datenbank, sieht als Notiz und als Quelle gleich aus (dieselbe Klasse
  `.source-text`) und wird ohne Umwandlung zur `.md`-Quelle. Die Doku nennt die Erweiterung eine frühe Version („early
  release“, Stand 2026-10-01). Darum sichert ein Rundlauf-Test (`note-extensions.test.ts`) Überschriften 1 bis 6, Fett,
  Kursiv, Code, Codeblock, Link, Listen (auch verschachtelt), Zitat und Trennlinie ab. Bekannte Grenze: Text, der wie
  Markdown aussieht (etwa ein eingefügtes „# kein Titel“), wird nicht maskiert und beim nächsten Öffnen zur Überschrift;
  beim Tippen kommt das kaum vor, weil `# ` und `1. ` sofort formatieren. Kein Unterstrich (Markdown kennt ihn nicht);
  der leere Schlussabsatz des Editors wird beim Speichern abgeschnitten.
- **Version der Pakete:** `@tiptap/react`, `pm`, `starter-kit` und `markdown` sind auf 3.31.3 festgesetzt, sie brauchen
  dieselbe Version. 3.31.4 war beim Einbau 19 Stunden alt und fiel durch die Schutzregel gegen frische Pakete; pnpm
  hatte dafür selbst 29 Ausnahmen in `pnpm-workspace.yaml` eingetragen. Die habe ich zurückgenommen, statt die Regel zu
  umgehen, 3.31.3 (vom 2026-09-04) besteht sie ohne Ausnahme.
- **Der Editor wird nachgeladen:** Er wiegt 460 kB. Das Hauptpaket war vorher 833 kB und wäre mit Editor auf 1.297 kB
  gewachsen; `React.lazy` in `note-viewer.tsx` holt ihn beim ersten Öffnen einer freien Notiz (mit Platzhalter), das
  Hauptpaket bleibt bei 837 kB.
- **Speichern wie im Original ohne Knopf:** `lib/save-queue.ts` ist reine Logik und getestet: 800 ms nach der letzten
  Eingabe, nie zwei Anfragen gleichzeitig, was in der Zwischenzeit getippt wird geht danach hinaus, das Neueste gewinnt,
  beim Schließen geht der Rest hinaus. Rechts neben „Als Quelle festlegen“ steht „Speichert …“ oder „Gespeichert“;
  scheitert es, steht darüber eine Meldung mit „Erneut versuchen“. Grenze: Scheitert das Speichern erst beim Schließen
  der Notiz (Netz weg), geht der letzte Rest verloren, es gibt keinen Zwischenspeicher im Browser.
- **Wie im Original (gemessen am 2026-10-01, `spikes/reference/NOTES.md` Abschnitt 10, lokal):** Titelzeile 74 hoch mit
  Titel als Feld (22/32) und Papierkorb statt ⋮-Menü; Format-Leiste 66 hoch zwischen zwei Linien, Knöpfe 32 rund, in
  der Reihenfolge Rückgängig, Wiederholen | „Normal ▾“ (Überschrift 1 bis 6) | Fett, Kursiv | Verknüpfen, Code,
  Codeblock | „⋯“ (waagerechte Leiste: Aufzählungsliste, Nummerierte Liste, Zitat, Trennlinie, Formatierung
  entfernen); Text 14/24. „Notiz hinzufügen“ ist eine Pille unten mittig in der Liste und ein runder Knopf unten in
  der eingeklappten Leiste, sie legt sofort „Neue Notiz“ an (Zeile „Notiz wird erstellt …“) und öffnet sie mit dem
  Cursor darin. Ein Titel von `null` heißt „Neue Notiz“ (bei einer Antwort: Anfang ihres Textes). „Verknüpfen“ ist ohne
  markierten Text aus; eine Adresse ohne Schema („tiptap.dev“) wird zu `https://`.
- **Abweichungen vom Original:** Die Schaltfläche „Normal“ zeigt die aktuelle Überschrift („Überschrift 1“), die
  Leiste verschiebt sich dadurch leicht; unter 480 px bricht sie um, die Trennstriche entfallen dort. „Als Quelle
  festlegen“ ist bei einer leeren Notiz aus (eine leere Quelle würde der Server ablehnen). Der Dateiname der Quelle
  folgt dem Titel (`.md` bei freien Notizen, `.txt` bei Antworten); der Text ist der aktuelle Stand im Editor, nicht
  der gespeicherte. Der Dialog zum Löschen erwähnt die Antwort im Chat nur bei einer gespeicherten Antwort.
- **Tests:** In jsdom fehlen `Range.getClientRects`, `Range.getBoundingClientRect` und `document.elementFromPoint`,
  die ProseMirror braucht; `test/setup.ts` ersetzt sie durch leere Antworten. Tiptap 3.31.3 setzte `role="textbox"` im
  Test nicht auf das Element (nur das `aria-label` kam an), ohne Rolle liest ein Screenreader das Label nicht sicher.
  Der Editor setzt Rolle und `aria-multiline` daher selbst. Im Browser (Desktop dunkel und hell, Handy 390 px,
  eingeklappte Leiste) geprüft: anlegen, schreiben, Überschrift, Fett, Kursiv, Liste, Link, umbenennen, als Quelle
  festlegen, Neuladen.

## 2026-10-01 (Notebook-Übersicht im Chat)

- **Wie im Original, nach Messung am echten Produkt (`spikes/reference/NOTES.md` Abschnitt 11, lokal):** Die Übersicht ist das erste
  Element im Scrollbereich des Chats und läuft mit dem Verlauf weg. Das Cover ist 265 hoch: Emoji 40 px oben links (24 Rand),
  unten der Titel 36/44 (Gewicht 320) und „n Quellen · TT.MM.JJJJ“ (14/24, Anlagedatum). 24 darunter die Zusammenfassung
  (16/24, fette Begriffe 600), dann 24 darunter die Leiste mit „In Notiz speichern“ und Kopieren (36 hoch). Beim Laden steht das
  Cover sofort da und die sieben Schimmerbalken der Zusammenfassung folgen; ein Fehler zeigt die Meldung mit „Erneut versuchen“
  unter dem Cover, der Chat bleibt benutzbar. Auf dem Handy ist das Cover 200 statt 265 hoch (dort nicht gemessen).
- **Ein Modellaufruf pro Änderung der Quellen, nicht pro Öffnen:** `GET /api/notebooks/:id/overview` liefert die gespeicherte
  Übersicht, solange der Schlüssel der fertigen Quellen (`notebookOverviewKey`: SHA-256 über die sortierten Quellen-IDs) derselbe ist,
  und macht sie sonst neu. Gespeichert wird im Notizbuch (`notebooks.overview`, `overview_key`, Migration 0011). Sie deckt alle
  fertigen Quellen ab, ausgewählt oder nicht, wie die „n Quellen“ im Cover. Gelesen werden höchstens 20 Quellen, der Text wird auf
  45.000 Zeichen verteilt (wer weniger braucht, gibt den Rest ab), das steht im Prompt. Alles geht über den Ratenbegrenzer der
  Rolle wie die Quellenübersicht; das Kontingent pro Nutzer betrifft weiter nur neue Quellen.
- **Das Web fragt erst, wenn alle Quellen fertig sind:** Solange eine Quelle wartet oder gelesen wird, bleibt die Abfrage aus
  (ein Upload, eine Übersicht statt eine je Quelle). Kommt eine Quelle dazu, bleibt die alte Zusammenfassung stehen, bis die neue
  da ist (`keepPreviousData`). Ohne fertige Quelle gibt es kein Cover, es bleibt der alte Hinweis „Stelle deine erste Frage“.
- **Das Emoji wählt das Modell, einmal:** Es steht in derselben Antwort (`NotebookOverviewSchema`: `emoji` und `summary`) und
  bleibt bei einer neuen Zusammenfassung, wie das Original sein Emoji behält. Die Startseite zeigt es auch
  (`NotebookSchema.emoji`, aus `overview->>'emoji'`), bis dahin das aus der ID abgeleitete. Das Emoji muss genau ein Symbol sein
  (eine Regex im Schema, nicht im JSON-Schema, das der Anbieter sieht).
- **Keine Zitate in der Zusammenfassung:** Wie die Übersicht einer Quelle beschreibt sie die Quellen und antwortet nicht auf eine
  Frage aus ihnen; Invariante 1 betrifft Antworten. Das Original hat dort ebenfalls keine Belege. Der Prompt verlangt, nur zu
  sagen, was die Quellen sagen, auf Deutsch und mit fetten Schlüsselbegriffen.
- **„In Notiz speichern“ legt eine freie Notiz an:** Titel „Zusammenfassung“, der Text als Markdown mit den fetten Begriffen. Dafür
  darf eine freie Notiz mit Titel und Text beginnen (`CreateNoteBodySchema`); das war vorher bewusst nicht erlaubt und gilt nur
  für freie Notizen, nicht für gespeicherte Antworten. Der Server hatte Titel und Text zuerst verworfen, der E2E-Test hat das
  gefunden. Danach steht „In Notiz gespeichert“, bis es eine neue Zusammenfassung gibt.
- **Nicht gebaut:** „Notebook anpassen“ (Emoji und Titel ändern, der Titel ist oben im Kopf bearbeitbar), die Daumen („Gute /
  Schlechte Zusammenfassung“, es gibt sie auch an Antworten nicht), ein vom Modell erzeugter Notizbuch-Titel.
- **Tagestrenner im Verlauf:** Über der ersten Nachricht jedes Kalendertags steht „Mittwoch, 30. September“ (12/16, 500, mittig,
  wie die Zeit darunter), nach der Zeitzone des Lesers. Rein darstellend, ohne Schnittstelle (`formatWeekday`, `isSameDay`
  in `lib/day.ts`). Gemessen ist nur der Trenner über der ersten Nachricht; dass das Original ihn an jedem Tageswechsel
  wiederholt, ist eine Annahme.
- **Keine Daumen an Chat-Antworten und an der Notizbuch-Zusammenfassung („Gute / Schlechte Antwort“):** Bei Studio-Ausgaben gibt es sie. Im Chat bräuchten gespeicherte Bewertungen (Tabelle, Schnittstelle, Tests) und
  zeigen für die Aufgabe nichts, was Zitate, Notizen und Studio nicht schon zeigen. Bewusst weggelassen.
- **Der leere Chat:** Mit Cover stehen darunter ein Satz zu den Nummern an den Aussagen und die Vorschlagsfragen; die große
  Überschrift „Stelle deine erste Frage“ gibt es nur noch ohne fertige Quelle. Der Demo-Seed macht die Übersicht mit, der erste
  Besuch wartet also nicht auf das Modell.
- **Geprüft:** Unit-, Datenbank- und E2E-Tests; im Browser Desktop dunkel, Handy 390 px, Startseite. Untertitel (y 293) und
  Zusammenfassung (y 364) liegen bei 1440 px genau auf den Werten des Originals.

## 2026-10-01 (Demo-Zugang als Gast)

- **Ein Knopf „Beispiel ausprobieren“ statt eines gemeinsamen Zugangs:** Ein geteilter Demo-Zugang hätte allen Besuchern
  dieselben Notizbücher gezeigt (jeder Upload eines Fremden läge bei den nächsten) und ließe sich nicht aufräumen. Der Knopf
  legt stattdessen pro Besucher ein Gastkonto an (`POST /api/guest`, Plugin `anonymous` von Better Auth, Spalte
  `user.is_anonymous`, Migration 0012) und gibt ihm eine Kopie des Beispiel-Notizbuchs. Der Gast landet direkt darin.
- **Die Kopie kostet kein Kontingent:** `copyNotebookToUser` kopiert in einer Transaktion Notizbuch, fertige Quellen mit
  Text und Übersicht und alle Abschnitte samt Vektoren per `INSERT … SELECT`; nichts wird neu gelesen oder eingebettet. Der
  Schlüssel der Notizbuch-Übersicht wird für die neuen Quellen-IDs neu berechnet, sie wird also nicht noch einmal erzeugt. Das
  Beispiel selbst bleibt unverändert. Es gehört dem Nutzer aus `SEED_DEMO_EMAIL` (`pnpm seed:demo`); ohne ihn oder ohne
  Beispiel antwortet die Route mit 503 `GUEST_UNAVAILABLE` und legt kein Konto an.
- **Grenzen gegen Missbrauch, ohne Zusatzdienst:** Höchstens 20 neue Gäste pro Stunde und 200 zugleich (`LIMITS.GUESTS_PER_HOUR`,
  `GUESTS_ALIVE`), gezählt in der Datenbank, für alle zusammen. Das ist keine Grenze pro Person (hinter dem Proxy wäre die IP
  nur mit zusätzlichem Vertrauen brauchbar); wer die Grenze ausreizt, sperrt für eine Stunde neue Gäste, aber nicht
  die bestehenden und nicht die normale Anmeldung. Die eigene Route des Plugins (`/api/auth/sign-in/anonymous`) ist zu (404),
  sonst ließe sich ein Gast ohne Kopie und ohne Grenze machen. Schlägt die Kopie fehl, wird der Gast wieder gelöscht.
- **Gäste werden nach 7 Tagen gelöscht,** samt Notizbüchern, Quellen und Sitzungen (alles hängt per `ON DELETE CASCADE`
  am Nutzer): beim Start und danach stündlich, ein einfacher Zeitgeber im Prozess statt einer eigenen Queue. Die App sagt es im
  Konto-Menü („Gast-Zugang. Deine Daten werden nach 7 Tagen gelöscht.“, `GUEST_LIMITS` in `packages/shared`).
- **Kein „Daten mitnehmen“ beim Registrieren:** Das Plugin könnte es (`onLinkAccount`), aber es müsste alle fünf Tabellen
  umhängen und Doppelte bei einer Anmeldung mit vorhandenem Konto auflösen. Für eine Handvoll Prüfer ist ein frisches Konto
  genug; ein Gast, der bleiben will, legt es neu an. Meldet sich ein Gast mit E-Mail an oder registriert sich, löscht das Plugin
  das Gastkonto.
- **Der Offline-Server legt das Beispiel selbst an** (mit den Fakes, einmalig, wiederholbar), damit der Knopf auch dort und im
  E2E-Test geht. Geprüft: Datenbank-Tests für Kopie, Zähler und Löschen, Route-Tests (Isolation zweier Gäste, 503, Grenze,
  geschlossene Plugin-Route), Web-Tests, ein E2E-Test (Knopf, Frage mit Zitat, Konto-Menü, Abmelden).

## 2026-10-01 (Deployment: Entscheidung und Stand)

- **Stand:** Vorbereitet und beschrieben ist Render (kostenloser Docker-Dienst) mit Neon, siehe [render.yaml](../render.yaml)
  und die README. Ausgeführt wurde es noch nicht. Das Deployment ist bewusst zurückgestellt; es gibt keine Live-URL.
- **Geplant: ein Hetzner-Server statt Render und Neon.** Grund sind die Kaltstarts: Render schläft nach 15 Minuten, Neon schaltet
  im kostenlosen Tarif nach 5 Minuten ab (nicht abschaltbar), ein Prüfer würde zweimal warten. Ein Server hält App und Datenbank
  dauerhaft wach, hat 40 GB statt 500 MB und liegt in Deutschland. Vorgesehenes Setup: Hetzner Cloud CX23 (x86, laut Drittquellen
  etwa 4 bis 5 € im Monat, Preis vor dem Buchen prüfen), Docker Compose mit Caddy (HTTPS), unserer App (das vorhandene Dockerfile)
  und `pgvector/pgvector` mit Volume, ein Gratis-Hostname (zum Beispiel `<IP>.sslip.io`), Deployment per GitHub Actions über SSH,
  Hetzner-Firewall (22, 80, 443), tägliches `pg_dump`, `/health` für einen Uptime-Check. Die `.env` liegt nur auf dem Server.
- **Verworfen: Vercel.** Die Ingestion läuft über einen dauerhaften `pg-boss`-Worker, Funktionen laufen dort nur pro Anfrage;
  Anfragen sind auf 4,5 MB begrenzt, unsere Uploads auf 10 MB; die Datenbank bliebe bei Neon. Das wäre ein Umbau von Ingestion und
  Upload nur für das Hosting.
- **Google bleibt im kostenlosen Tarif** (Entscheidung des Nutzers, keine Abrechnung). Folge: Das Tageskontingent bleibt der
  Engpass, und Google darf Eingaben zur Modellverbesserung nutzen; die README warnt davor, sensible Dokumente hochzuladen.
  Gäste kosten dabei kein Kontingent (Kopie ohne Modellaufruf).
- **Plan B** bleibt Render + Neon (oder Render bezahlt, damit der Dienst nicht einschläft; Preise nicht geprüft).
- **Offen:** Deploy-Dateien (Compose, Caddyfile, Workflow, Anleitung) sind nicht geschrieben.

## 2026-10-01 (Abgleich, Runde 4: fehlende Kleinigkeiten)

- **Auslöser:** Der Nutzer nennt vier Lücken zum Original: Box „Im Web nach Quellen suchen“, klickbarer Titelblock (öffnet
  „Notebook anpassen“), Knopf „Nach unten springen“, „Thoughts“ unter jeder Antwort. Diese vier und weitere Lücken werden
  in dieser Runde abgeglichen (neue Messungen: `spikes/reference/s8-*`, lokal).
- **Web-Suche:** nur „Web“ mit schneller Recherche. Weggelassen: Drive (bräuchte Google-Anmeldung mit Dateizugriff) und
  Deep Research (Minuten Laufzeit, teuer). Kein Menü mit nur einem Eintrag. Erst ein Test mit dem echten Modell (Google-Suche
  als Werkzeug, Verträglichkeit mit dem JSON-Schema, Kosten im kostenlosen Tarif), dann Bau.
- **Thoughts:** erst ein Test, ob Gedankenzusammenfassungen (`includeThoughts`) mit unserem JSON-Schema-Streaming und dem
  Lite-Modell brauchbar sind; Gedanken-Tokens zählen als Ausgabe.
- **Titelbild für „Notebook anpassen“:** S3-kompatibler Speicher hinter einem Port (`apps/api/src/storage`) mit einer
  Implementierung (AWS SDK v3, Pfad-Adressen), einem Fake für Tests und einem Integrationstest gegen den Container.
  Entscheidung des Nutzers, auch um Full-Stack-Können zu zeigen. Kein AWS nötig; bei Plan B (Render) wäre ein Anbieter wie R2
  oder S3 nötig, Preise vorher prüfen. Ein Docker-Volume ist dauerhaft, aber nicht gesichert (wie die Datenbank auf demselben
  Server).
- **Geändert: SeaweedFS statt MinIO.** Beim Prüfen der Quellen (Regel 12) zeigte sich, dass die Community-Ausgabe von MinIO
  seit Oktober 2025 keine Images mehr veröffentlicht und am 25. April 2026 archiviert wurde. Der Code spricht nur das
  S3-Protokoll, deshalb ist der Server austauschbar. Gewählt: SeaweedFS (Apache-2.0, aktiv, ein Programm mit S3-Zugang).
  Fallstricke: je Bucket ein eigenes Volume, auf der kleinen Test-Platte deshalb `-volume.max` und eine kleine
  `volumeSizeLimitMB`; der Health-Check nimmt jede HTTP-Antwort (auch 403) als „läuft“.
- **Titelbild, Regeln:** nur PNG, JPEG, WebP bis 2 MB; der Typ wird an den ersten Bytes erkannt, nicht am Namen oder an der Angabe des
  Browsers (kein SVG, keine Seite als Bild). Jedes Bild bekommt eine neue Version im Schlüssel (`covers/<Nutzer>/<Notizbuch>/<Version>`),
  der Browser darf es lange zwischenspeichern (`private`). Löschen des Notizbuchs und das Ablaufen eines Gasts löschen die Datei mit; eine
  Kopie des Notizbuchs bekommt kein Bild. Ohne Speicher (keine `S3_*`-Werte) wird der Upload nicht angeboten.
- **Entschieden (Nutzer):** „Thoughts“ als echte Schritte des Servers in Deutsch („Vorgehen“, `chat_messages.trace`, Migration 0015),
  nicht die Gedanken des Modells. Web-Suche über Tavily (`TAVILY_API_KEY`, optional; 10 Suchen je Nutzer und Stunde, 30 am Tag für
  alle; nur die Suchbegriffe gehen an Tavily; das Hinzufügen läuft über den normalen URL-Import mit SSRF-Schutz).

- **Gebaut in dieser Runde** (je ein Commit auf `feat/gaps-round-4`): Knopf „Nach unten springen“ (sichtbar ab 48 px Abstand zum Ende);
  „Notizbuch anpassen“ (Titelblock und Menü öffnen den Dialog: Titel und eigene Zusammenfassung; die eigene Zusammenfassung ersetzt die
  des Modells, kostet keinen Modellaufruf, das Emoji bleibt; Spalte `custom_summary`, Migration 0013); Reihenfolge der Aktionsleiste
  (In Notiz speichern vor Kopieren); Quellen sortieren (Letzte, Titel, Typ; ohne Auswahl bleibt die Reihenfolge des Servers); Quelle
  umbenennen (der Titel gehört zur Quelle und gilt in allen Notizbüchern des Nutzers); Studio-Ausgabe umbenennen (ein gemeinsamer
  `RenameDialog`; „Prompt und Quellen ansehen“ gibt es schon als Chip in der Ansicht); Notizbuch kopieren (verknüpft dieselben
  Quellen, es wird nichts neu gelesen oder berechnet, weil ein Inhalt pro Nutzer nur einmal vorkommen darf; Chat, Notizen und
  Studio-Ausgaben bleiben beim Original); Startseite: Titel bearbeiten und Oben anpinnen (Spalte `pinned_at`, Migration 0014).
- **Korrigiert:** Die Bestätigen-Dialoge schlossen sich beim Klick, bevor ein Fehler zu lesen war. Der Knopf schließt jetzt nicht mehr
  selbst, die Aufrufer schließen bei Erfolg.
- **Bewusst nicht gebaut:** Handy-Eingabeleiste mit Dokument-Symbol (gibt es schon), Ausgabesprache als Konto-Einstellung (die Sprache
  der Antworten lässt sich je Notizbuch unter „Chat konfigurieren“ wählen), „Alle Notizen als Quelle festlegen“.
- **Offen:** Die Deploy-Dateien für Hetzner brauchen den S3-Dienst im Compose (siehe `docker-compose.yml`, Dienst `s3`) und ein
  Volume statt `tmpfs`.

### Review von Runde 4 (2026-10-01)

Ein Code-Review (Superpowers) und ein Audit der Oberfläche (Impeccable) ergaben keinen kritischen Fehler. Behoben:

- **Titelbild-Upload hat ein Größenlimit vor dem Einlesen:** `bodyLimit` (2 MB plus 64 KB für den Rahmen der Anfrage) steht vor der
  Route, wie beim Quellen-Upload. Die Prüfung im Handler bleibt. Antwort bei zu großem Inhalt: 400 `COVER_INVALID`.
- **Zeitlimit der Websuche:** `LIMITS.WEB_SEARCH_TIMEOUT_MS` (10 s) wird als `AbortSignal` an Tavily übergeben. Ein Zeitablauf ist ein
  Fehler (500), ohne Ersatzantwort.
- **Aufräumen im Speicher ist „Best Effort“ (bewusste Ausnahme von „kein stilles Abfangen“):** `removeObjectQuietly` und
  `removePrefixQuietly` (`storage/remove-quietly.ts`) protokollieren einen Fehler (Schlüssel, Fehlername) und werfen nicht. Grund: Die
  Änderung in der Datenbank ist dann schon gemacht, ein Ausfall des Speichers darf daraus keinen 500 machen. Folge: Eine Datei kann
  ohne Verweis übrig bleiben. Ein Aufräumlauf dafür ist nicht gebaut (Dateien sind höchstens 2 MB und Titelbilder sind optional).
  Beim Löschen abgelaufener Gäste läuft die Schleife nun auch nach einem Fehler weiter.

Bewusst nicht geändert (Notiz):

- **Suchgrenzen werden nicht zurückgegeben:** Eine fehlgeschlagene Tavily-Anfrage verbraucht trotzdem einen Platz (je Nutzer und
  für alle). Das schützt das Monatskontingent (1000) auch bei Fehlern. Wer das ändert, braucht eine Rückgabe im `createWindowLimit`.
- **`createWindowLimit` leert leere Fenster nicht:** Der Speicher wächst mit der Zahl der Nutzer, die je gesucht haben (klein, ein Container).
- **`chrislusf/seaweedfs:latest` ist nicht festgelegt:** Eine feste Version (vorher in der Doku prüfen) gehört in die Deploy-Dateien.
- **Oberfläche:** Bedienflächen von 36 bis 40 px und Reiter mit 28 px Höhe folgen dem Original, nicht den 44 px der Empfehlung.
  `prefers-reduced-motion` setzt alle Übergänge auf 0,01 ms (`index.css`), ohne Ersatz für die Rückmeldung. Weder `PRODUCT.md` noch
  `DESIGN.md` gibt es; der Abgleich liegt in [DESIGN-ABGLEICH.md](DESIGN-ABGLEICH.md).

### Prüfung auf Redundanz und Ersatz durch Pakete (2026-10-01)

Gemessen an Zeilen: Frontend-Komponenten 8.000, Datenbank-Schicht 1.900, Routen 1.300, `core` 950, Gemini-Schicht 360. Die
Duplikat-Quote von `jscpd` liegt bei 0,74 % (15 kleine Treffer, vor allem Testläufe und Schema), kein Ersatz nötig. Geprüft wurde, ob
eigener Code durch ein Paket ersetzbar ist. Ergebnis: Es bleibt, wie es ist.

- **HTML nach Markdown (`parsing/html-text.ts`, 324 Zeilen) bleibt.** Versuch mit `turndown` plus `turndown-plugin-gfm` und denselben
  23 Fällen wie in `html-text.test.ts`: nur 8 gleich. Die Abweichungen sind nicht nur Schönheit: `javascript:`- und `mailto:`-Links
  bleiben erhalten, `data:`-Bilder erscheinen, relative Links werden nicht aufgelöst (kein Basis-Link), Tabellen ohne Kopfzeile bleiben
  rohes HTML, `<pre>` wird kein Codeblock, der Strich in einer Zelle wird nicht maskiert und Überschriften behalten Links. Jede Angleichung
  wäre eine eigene `turndown`-Regel; am Ende stünde etwa derselbe Umfang plus eine Abhängigkeit. Außerdem hängt der Inhalts-Hash der Quelle
  (Regel „idempotente Aufnahme“) vom Text, den dieser Schritt erzeugt.
- **SSRF-Schutz (`core/ssrf.ts`, `import/fetch-url.ts`) bleibt.** Er nutzt schon `node:net` (`BlockList`, `isIP`), und ein Paket müsste die
  Prüfung nach jedem Redirect und die festgelegte Adresse von `undici` mitbringen (Annahme, kein Paket geprüft). Sicherheitscode, der
  schon klein ist und getestet wird, tauscht man nicht ohne Not.
- **Zwei gleitende Fenster bleiben getrennt.** `RateLimiter` (blockiert, gewichtet nach Tokens, für Gemini) und `createWindowLimit`
  (nimmt oder lehnt ab, je Nutzer) haben verschiedene Aufgaben; ein Paket (`rate-limiter-flexible`, `bottleneck`) deckt keins der beiden
  mit Uhr zum Testen ab (siehe Eintrag oben zum Limiter).
- **Bildtyp (`core/image-type.ts`, 25 Zeilen) bleibt.** `file-type` erkennt Hunderte Typen und lädt viel; wir erlauben drei.
- **Kleines bleibt klein:** `relative-time.ts` und `use-wide-layout.ts` nutzen schon `Intl` und `useSyncExternalStore`. Der
  SSE-Leser im Browser (`chat-stream.ts`, 49 Zeilen) ließe sich durch `eventsource-parser` ersetzen; der Gewinn wäre etwa 15 Zeilen.
  `pdf-lib` dient nur dem Seitenzählen (7 Zeilen), bleibt, weil das Zählen ohne Anbieteraufruf geschehen muss (Alternativen nicht verglichen).
- **Abweichung vom Plan, nachgetragen:** [PLAN.md](PLAN.md) nennt für die LLM-Schicht das Vercel AI SDK. Gebaut ist ein eigener
  schlanker Client (`ai/gemini-http.ts`, `gemini-chat.ts`, `gemini-pdf-parser.ts`, `gemini-embedder.ts`, zusammen 360 Zeilen) mit Wiederholung bei
  429/503 und dem Ratenbegrenzer davor. Das wurde damals nicht eingetragen. Ein Wechsel würde Zeilen sparen, aber die Tests, die auf der
  Form der HTTP-Antworten beruhen (MSW), und den Strom der Aussagen (`core/statement-stream.ts`) neu fassen, und die in den Spikes
  gemessenen Eigenheiten (Gedankenzusammenfassungen, `thinkingLevel`) laufen heute über rohe Felder. Nicht jetzt; wenn das Studio mit
  mehreren Modellen arbeiten soll, lohnt ein neuer Blick.

### CI wieder grün und ein schlankeres Setup für Agenten (2026-10-01)

CI war seit dem 30.09. auf `main` rot, ohne dass es auffiel: Die Hooks lassen `test:db`, `e2e` und Semgrep aus, und der Agent sah CI nicht.

- **Ursachen und Behebung:** (1) `test-db` brauchte den S3-Dienst, den der Job nicht startete: Schritt `docker compose up -d --wait s3`.
  (2) Im Browser-Test verdeckte das noch offene Hover-Fenster der Quellenmarke den Schließen-Knopf: Der Test bewegt vorher die Maus weg.
  (3) Semgrep: zwei gleiche handgeschriebene Escape-Funktionen. Zuerst durch eine gemeinsame ersetzt, dann die Ursache beseitigt: Markup
  wird nicht mehr aus Textschnipseln gebaut. Das Mindmap-Bild (`components/studio/mindmap-picture.tsx`) und der Bericht zum Einfügen
  (`report-html.tsx`) sind JSX und werden mit `renderToStaticMarkup` zu Text; React maskiert dabei jeden Text selbst. Der Renderer
  (`react-dom/server`, 61 kB gzip) ist ein eigener Baustein, der erst beim ersten Herunterladen oder Kopieren geladen wird. Das Favicon liegt als Datei in `public/`
  statt als Data-URI. Ob Semgrep damit durchläuft, zeigt erst CI (lokal nicht installiert).
- **SeaweedFS fest auf `4.48`** (Tag auf Docker Hub geprüft), nicht mehr `latest`.
- **Weniger Ausgabe, weniger Token:** `pnpm test` schrieb ~140 Zeilen (Warnungen zu `localStorage`, einmal je Worker); mit
  `NODE_OPTIONS=--no-experimental-webstorage` sind es 16. `pnpm check` listete bei jedem Lauf alle 15 Duplikate unter der Schwelle; jscpd
  meldet jetzt nur noch beim Überschreiten (`--reporters threshold`), die Liste gibt `pnpm audit:duplication:details`. Zwei Knip-Hinweise entfernt.
- **Stop-Hook:** Er merkt sich einen bestandenen Lauf an einem Hash der geänderten Code-Dateien (`.git/guard-stop-last-pass`) und prüft
  nicht erneut, wenn sich nichts geändert hat. Ein Fehlschlag wird nie gemerkt. Läuft `pnpm check` in die Zeitgrenze (100 s), blockiert der
  Hook nicht mehr (das sagt nichts über den Code).
- **Freigaben im Repo:** `.claude/settings.json` erlaubt jetzt die Befehle der täglichen Schleife (`pnpm check/test/typecheck/lint/e2e`,
  `pnpm exec vitest`, `git status/diff/log/add/commit/push/switch/merge`, `gh run`). Force-Push, `--no-verify`, Löschen und `.env*`
  sperrt weiter der Wächter. Vorher fragte jeder dieser Befehle in einem frischen Checkout nach.
- **`AGENTS.md`:** richtiger Befehl `pnpm --filter @nlm/api db:generate`; die Ausnahme für das stille Aufräumen im Speicher;
  „nach dem Push `gh run list` ansehen“; ENTSCHEIDUNGEN.md (60 KB) suchen statt ganz lesen; die DoD-Quittung nur für Features.
- **Nicht geändert:** Der Wächter liest den Text eines Heredocs wie Befehle. Das zu lockern würde `bash <<EOF … EOF` als Umgehung öffnen.
  Dateien schreibt man mit dem Write-Werkzeug.
