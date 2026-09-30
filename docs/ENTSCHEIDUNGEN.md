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
  eindeutig). Freitext-Notizen gibt es bewusst nicht; sie wären ohne Zitate und ohne Prüfung.
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
  Parameter (Anzahl, Schwierigkeit, Thema); nur der Bericht fragt nach der Vorlage. (4) Keine „Notiz
  hinzufügen“-Pille mit freiem Text: Notizen sind bei uns gespeicherte Antworten und bleiben ein Abschnitt im
  Studio. (5) Kein „ungelesen“-Punkt an Ausgaben (würde einen Lesestatus pro Ausgabe brauchen). (6) Die
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
  (PDF rot). Nicht übernommen: „Notiz hinzufügen“ (freie Notizen; unsere Notizen sind gespeicherte Antworten mit
  Belegen, ein freier Text hätte keine).
