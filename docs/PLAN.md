# NotebookLM-Klon: Requirements, Stack v3 und Spike-Plan

Sep 29, 2026 · @Oguz Öztürk

## Ziel und Rahmen

Ziel ist ein NotebookLM-Klon in production-ready Qualität, abgegeben mit drei Artefakten: GitHub-Repo, Live-Deployment und ein Loom-Video von höchstens 10 Minuten, in dem du Vorgehen und Umsetzung erklärst und den Klon live testest.

- **Aufgabe:** Everlast AI, zweite Runde. Umsetzung, Umfang und Struktur sind frei, die Nutzung von AI-Tools ist ausdrücklich erwünscht.
- **Beweisziel:** Du beherrschst den Stack eines Full-Stack-Engineers (React, Node.js, PostgreSQL, API-Design, LLM-Integration).
- **Schwerpunkt:** AI-Kern (RAG, verifizierbare Zitate, Evals) und ein sichtbarer agentischer Workflow im Repo. Breite nur so weit nötig.
- **Zeit:** 4 bis 5 volle Arbeitstage, die Frist beträgt eine Woche. Ziel ist, früh fertig zu sein und den Rest als Puffer zu behalten.
- **Kosten:** minimal bis kostenlos. Bauen und Testen im Gemini Free Tier, 5 Dollar Guthaben als Reserve für Paid.
- **Sprache:** Oberfläche nur Deutsch. Quellen und Fragen dürfen Englisch sein.

## Was NotebookLM ausmacht

Der Kern ist ein Chat, der nur auf deinen eigenen Quellen antwortet und jede Aussage mit einem nummerierten Zitat belegt, das direkt zur Textstelle führt. Alles andere hängt daran: Notebook anlegen, Quellen hinzufügen, chatten, Studio-Outputs erzeugen.

**Was dein Screenshot zeigt (Gemini Notebook, deutsche Oberfläche):**

- Zitate sind **nummerierte Chips im Fließtext**, mehrere pro Aussage sind möglich. Die Nummern stehen offenbar für einzelne Passagen der Quelle (aus dem Bild geschlossen).
- **Hover** öffnet ein Popup mit Dateiname, dem zitierten Passagentext (scrollbar) und dem Link "Quelle anzeigen".
- Gleichzeitig zeigt das **linke Panel den extrahierten Quelltext** mit hervorgehobener Passage. Es ist kein PDF-Viewer und es gibt keine Seiten-Overlays.
- Die Hervorhebung deckt **ganze Absatzblöcke** ab, nicht einzelne Sätze. Die Granularität ist der Chunk.
- Dazu: Quellenübersicht oben im Quellenpanel, Zähler "1 Quelle" im Eingabefeld, Notizen, Hinweis "kann Fehler machen".
- **Studio:** Audio, Präsentation, Video, Mindmap, Berichte, Karteikarten, Quiz, Infografik.

**Sprache:** NotebookLM hat die Einstellung "Output Language" für Chat und generierte Inhalte, Standard ist die Sprache des Google-Kontos. Quellen bleiben in ihrer Originalsprache. Laut einer Drittquelle antwortet es ohne diese Einstellung in der Sprache der letzten Nachricht.

**Konsequenz für den Klon:** Zitate sind chunk-genau und werden im extrahierten Text hervorgehoben. Wir brauchen weder Bounding Boxes noch einen PDF-Viewer. Wie NotebookLM intern arbeitet, ist nicht belegt (nur Sekundärquellen).

## Requirements

Wenige Funktionen in hoher Qualität schlagen viele halbfertige. Der Kern ist der Weg von der Quelle zum nachprüfbaren Zitat.

**Must**

1. Anmeldung und Notebooks anlegen, auflisten, löschen.
2. Quellen hinzufügen: PDF, DOCX, TXT/MD und URL. Die Verarbeitung läuft asynchron mit Status und verständlichen Fehlermeldungen.
3. Chat mit Streaming, der nur auf den gewählten Quellen antwortet, mit nummerierten Zitaten. Hover zeigt das Popup, Klick öffnet den Quelltext mit Chunk-Hervorhebung.
4. Quellen an- und abwählen. Die Auswahl begrenzt auch das Retrieval.
5. Quellenübersicht pro Quelle (Zusammenfassung und Schlüsselthemen).
6. Live-Deployment, README und ein Demo-Zugang mit vorbefülltem Beispiel-Notebook.

**Should**

- Vorschlagsfragen beim Hinzufügen einer Quelle.
- Notizen aus Antworten speichern.
- Chat-Konfiguration pro Notebook (Ziel, Ton, Ausgabesprache; Standard ist die Sprache der Frage).
- Studio: Bericht (Briefing, FAQ, Study Guide), Karteikarten, Quiz. Alles strukturierte Ausgaben auf den vollständigen Quellen.

**Stretch**

- Mindmap (JSON-Baum, Klick auf einen Ast öffnet einen Chat).
- PPTX als Quelle.
- Agentische Suche im Chat, nur wenn nach Tag 4 Zeit bleibt.

**Bewusst nicht**

- Audio- und Video-Overview, Infografik, Präsentation, Deep Research.
- Sharing und Kollaboration, YouTube- oder Audio-Transkription, Drive-Anbindung, Mobile.
- Originaldateien speichern (nur extrahierter Text plus Metadaten).

**Qualitätsanforderungen (production-ready)**

- SSRF-Schutz beim URL-Import, Upload-Limits (Größe, Seitenzahl), Rate Limiting und Quoten pro Nutzer.
- Env-Validierung mit Zod, Health-Check, strukturierte Logs, Migrationen mit drizzle-kit.
- Tests: Vitest, ein Playwright-Smoke-Test, ein Eval-Skript mit Golden-Fragen. Tests laufen ohne echte API-Aufrufe (Fixtures und Mocks), damit sie kein Tageskontingent verbrauchen.
- CI mit Typecheck, Lint und Tests, dazu eine AGENTS.md, die deinen agentischen Workflow im Repo sichtbar macht.

## Architektur und Datenfluss

&#91;embedded content: Architektur · 3 Abläufe, 1 Datenbank\]

Die Ingestion schreibt Chunks und Vektoren in Postgres, der Chat liest nur die passenden Chunks der gewählten Quellen, das Studio lädt die gewählten Quellen vollständig.

## Tech Stack v3

React-Frontend und Node.js-Backend in einem Monorepo, ein Container, Postgres mit pgvector, Gemini im Free Tier. Docling und ein zweiter Service entfallen. Preise und Benchmarks stammen teils aus Drittquellen (Stand 29.09.2026) und sind vor dem Bau zu prüfen.

| Bereich          | Wahl                                                                                                                      | Begründung / Alternative                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Runtime, Sprache | Node.js LTS, pnpm-Workspaces, TypeScript strict, Zod in `packages/shared`                                                 | Everlast-Anzeige nennt Node.js und JavaScript. Bun bewusst nicht                                                           |
| Frontend         | React 19, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, react-markdown                                         | Anzeige nennt React. Ein getrenntes Frontend zeigt API-Design sichtbar                                                     |
| Backend          | Hono mit `@hono/zod-openapi`, SSE-Streaming, liefert auch das Frontend aus                                                | Typisierter RPC-Client und OpenAPI aus Zod-Schemas. Fastify, Express oder NestJS wären gleichwertig, Hono ist austauschbar |
| Auth             | Better Auth mit Drizzle-Adapter                                                                                           | Nutzer in der eigenen Postgres. Supabase Auth bringt bei direkter DB-Verbindung keinen RLS-Vorteil                         |
| Datenbank        | Neon Postgres (dauerhaft kostenlos, 500 MB), pgvector mit HNSW, Postgres-Volltextsuche, Drizzle ORM                       | Render-Postgres läuft im Gratis-Tarif nach 30 Tagen ab                                                                     |
| Jobs             | pg-boss                                                                                                                   | Etablierte Postgres-Queue statt Eigenbau. Pooler-Modus des Hosts prüfen                                                    |
| Parsing          | PDF: Gemini 3.1 Flash-Lite (Spike entschieden, [Ergebnisse](SPIKE-ERGEBNISSE.md)). DOCX: mammoth. TXT/MD direkt. URL: Readability. Fallback: liteparse | ParseBench (Tabellen / Inhaltstreue): Gemini 3.1 Flash-Lite 85,5 / 89,5, Docling 66,4 / 66,9, LiteParse 42,4 / 70,0        |
| Embeddings       | Gemini Embedding 2 mit 768 Dimensionen, Fallback `gemini-embedding-001`                                                   | Limits bekannt (RPM 100, TPM 30K, RPD 1000), im Spike gleichauf mit 001 (17 gegen 16 von 18). Die Vektorräume beider Modelle sind inkompatibel                              |
| Retrieval        | pgvector plus Volltextsuche, Fusion per RRF in SQL                                                                        | Hybrid fängt Eigennamen und Zahlen, die Vektorsuche verfehlt (im Spike ein Fehltreffer, der zu einer falschen Antwort führte)                                                               |
| LLM-Schicht      | Vercel AI SDK, Modell-IDs und Limits in der Config                                                                        | Chat: Gemini 3.5 Flash-Lite (Spike entschieden, GPT-6 Luna ungemessen). Studio: 3.x Flash, Fallback Flash-Lite  |
| Zitate           | Strukturierte Ausgabe mit Chunk-Nummern, Server prüft, dass die zitierten Chunks im Kontext waren                         | Anthropic-Citations verworfen (Kosten, Anbieter-Bindung)                                                                   |
| Tests, Qualität  | Vitest, Playwright-Smoke, Eval-Skript, ESLint, Prettier, GitHub Actions                                                   | Tests ohne echte API-Aufrufe                                                                                               |
| Hosting          | Render (kostenloser Web Service) plus Neon                                                                                | Kaltstart etwa 1 Minute nach 15 Minuten Leerlauf, im README erwähnen                                                       |

**Abgrenzung zu notar-agent:** Übernommen werden Zod, Drizzle, pgvector und das Hybrid-Retrieval mit RRF. Neu bzw. geändert sind Auth, Queue (pg-boss statt Eigenbau), Parsing (Gemini statt liteparse plus mammoth für alles) und der Verzicht auf Supabase.

**Setup aus notar-agent (übernommen und angepasst, Stand Tag 1):** Die Regeln stehen in `AGENTS.md`, die Prüfungen laufen mit `pnpm check` (rund 2 Sekunden) und `pnpm test`.

- **Gate `check`:** `tsc` je Paket, ESLint, dependency-cruiser, knip, jscpd (Schwelle 2 %) und Magic-String-Audit. Der Health-Score entfällt: Er startete jscpd, depcruise, knip und den Audit ein zweites Mal und ließ Abstürze der Tools als 100 Punkte durch. Die Einzeltools sind schon harte Gates.
- **dependency-cruiser:** `packages/shared` ist ein Blatt ohne Implementierung (npm nur `zod`), `apps/api` und `apps/web` importieren sich nicht gegenseitig. Einzige Ausnahme ist `import type` des `AppType` für den Hono-RPC-Client. `core` ist rein (kein Hono, keine DB, keine AI-Anbieter).
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `noUnused*`, 6.0 (typescript-eslint unterstützt TypeScript 7 noch nicht).
- **ESLint:** unter anderem keine Modell-ID-Literale außerhalb von `apps/api/src/config`, kein `console` in der API, keine Funktionen oder Klassen in `packages/shared`, kein `export *`, kein `as unknown as`.
- **`AGENTS.md`:** Pre-Flight (kurz), SSOT, YAGNI mit Rule of Three, SoC vor DRY, keine autonomen Commits, Definition-of-Done-Quittung. Die notariellen Regeln fallen weg. Neu sind Invarianten für Zitat-Vertrag, idempotente Ingestion, Retrieval-Scope pro Nutzer, Modell-IDs nur aus der Umgebung, Tests ohne echte API-Aufrufe, SSRF-Schutz und keine Dokumentinhalte in Logs. `CLAUDE.md` importiert nur `@AGENTS.md`.
- **Hooks und Rechte** (`.claude/settings.json`): `git commit` und `git push` sind gesperrt, `.env*` (außer `.env.example`) ist weder les- noch schreibbar, das Lockfile ist gesperrt, `AGENTS.md`, `.claude/` und neue Abhängigkeiten gehen nur mit Nachfrage. Zwei Hook-Skripte prüfen rekursives `rm`, `git`-Varianten und Geheimnisse (`guard-bash`) und lassen den Agenten erst enden, wenn `pnpm check` grün ist (`guard-stop`). Beides ist keine Sicherheitsgrenze, sondern eine statische Prüfung des Befehlstexts.
- **Skills und MCP:** chrome-devtools läuft als MCP-Server auf Benutzerebene (nicht im Repo). `software-craftsmanship` wurde nicht übernommen, weil `AGENTS.md`, ESLint und die Audits dieselben Regeln schon erzwingen. `context7` entfällt. Ein Skill für den Zitat-Vertrag folgt, sobald der Vertrag steht.
- **Husky:** Beim Commit erst lint-staged, dann `check`. Beim Push die Tests.
- **CI:** GitHub Actions mit den Jobs quality, test, build und Semgrep (alle blockierend, erster Lauf grün). Die Actions sind auf Commit-SHAs gepinnt.
- **Neu gegenüber notar-agent:** Env-Validierung mit Zod (`apps/api/src/config/env.ts`, bricht beim Start ab und nennt nie Werte), Netzwerk-Riegel in Tests (MSW lehnt jede nicht abgefangene Anfrage ab), Tests für die Hook-Skripte selbst.
- **Eval:** Übernommen ist die Idee, keine Zeile Code. Es gibt ein Dataset-Schema mit Textankern statt Chunk-IDs und vier reine Scorer (Trefferquote in den Top k, Zitat-Gültigkeit, Zitat-Abdeckung, Pflichtfakten). Promptfoo, der Jev-Judge und ein Mock-Modell aus der Ground Truth entfallen, weil das Mock-Modell nur die Verdrahtung prüfte, nicht die Qualität. Stattdessen sollen aufgezeichnete Modellantworten offline abgespielt werden. Latenz und Token werden im Spike aufgezeichnet, nicht bewertet. Der Fact-Checker (Snippet steht wörtlich im Quelltext) bleibt optional.

**Nicht übernommen:** Supabase-RLS und -Repositories (Autorisierung liegt in der API), Next.js-Route-Handler, Audit-Trail mit Hash-Kette, Wissensdatenbank der Rechtsnormen, PII-Logging-Scan (§ 203 StGB), Supabase-N+1-Scan, Health-Score, promptfoo und die Fixture-Generatoren für Notar-Scans.

## Free-Tier-Limits und Kostenstrategie

Der Engpass ist nicht Parsing oder Chat, sondern die 20 Tagesanfragen der großen Flash-Modelle und die 30K Embedding-Tokens pro Minute. Die Werte stammen aus deiner AI-Studio-Konsole (Stand 29.09.2026).

| Modell                        | RPM | TPM  | RPD  |
| ----------------------------- | --- | ---- | ---- |
| Gemini 3.1 und 3.5 Flash-Lite | 15  | 250K | 500  |
| Gemini 3.5 bis 3.8 Flash      | 5   | 250K | 20   |
| Gemini Embedding 2            | 100 | 30K  | 1000 |

Die Limits gelten pro **Projekt**, nicht pro Key. Das Tageslimit wird um Mitternacht Pacific Time zurückgesetzt, in Hamburg um 9 Uhr.

**Maßnahmen**

- **Zwei Google-Projekte:** eines für Bauen und Testen (Free Tier), eines für das Live-Demo. So verbraucht dein Testen nie das Kontingent der Reviewer.
- **Rate-Limiter im Worker** (z. B. bottleneck), Limits aus der Config, Wiederholung mit Wartezeit bei 429.
- **Inhalts-Hash pro Datei**, damit dasselbe Dokument nie zweimal geparst oder eingebettet wird. Embeddings im Batch.
- **Demo-Limits:** z. B. 3 Uploads pro Nutzer und Tag, höchstens 50 Seiten pro Quelle, verständliche Meldung bei erschöpftem Kontingent. Ein vorbefülltes Beispiel-Notebook verbraucht kein Kontingent.
- **Kill-Switch** per Umgebungsvariable, der neue Uploads sperrt, falls das Guthaben knapp wird.
- **Hinweis im Demo:** keine sensiblen Dokumente hochladen. Für das Free Tier können Google-Bedingungen zur Datennutzung gelten, bitte einmal lesen.

**Paid-Wechsel:** 5 Dollar Guthaben als Reserve, Wechsel nur per Umgebungsvariable und neuer Limit-Tabelle. Offen ist, ob du nach dem Verknüpfen von Billing die Free-Kontingente behältst (rechne nicht damit), ob das Guthaben hart begrenzt ist und ob es eine automatische Aufladung gibt, die du ausschalten solltest.

**Preise laut Drittquellen (pro Million Tokens):** GPT-6 Luna 0,10 $ Eingabe und 0,50 $ Ausgabe, Gemini 3.5 Flash-Lite 0,30 $ und 2,50 $. Auf den Preisseiten verifizieren.

**Rechenbeispiel (Annahmen):** 5 Reviewer laden je 3 Dokumente à 20 Seiten hoch und stellen je 30 Fragen. Das ergibt etwa 60 Parsing-Anfragen (5 Seiten pro Anfrage) und etwa 150 Chat-Anfragen, beides unter 500 pro Tag. Bei den Embeddings hängt es davon ab, ob ein Batch als eine oder als viele Anfragen zählt.

## Spike-Plan

Ein Spike ist ein zeitlich begrenzter Wegwerf-Test, der eine Unsicherheit klärt, bevor wir uns festlegen. Ein kombinierter Modell-Spike (etwa ein halber Tag) entscheidet Parsing, Chat, Embeddings und Zitat-Format mit Zahlen.

**Testmenge:** 6 bis 8 Dokumente (zweispaltiges Paper, tabellenlastiger Bericht, DOCX mit Tabellen und Bildern, einfacher Text-PDF, ein Scan, deutsch und englisch gemischt) und 10 bis 20 Fragen, darunter deutsche Fragen auf englische Quellen.

| Aufgabe    | Kandidaten                                                              | Messgrößen                                                                                          | Entscheidungsregel                                                                               |
| ---------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Parsing    | Gemini 3.1 Flash-Lite gegen liteparse (lokal, deterministisch)          | Auslassungen, Tabellenstruktur und Lesereihenfolge (Stichprobe von Hand), Zeit und Kosten pro Seite | Höchste Inhaltstreue gewinnt, bei Gleichstand der günstigere                                     |
| Chat       | Gemini 3.5 Flash-Lite, ein größeres Flash-Modell nur als Stichprobe     | Antwortqualität, Zitat-Treffer, Zeit bis zum ersten Token, Kosten pro brauchbarer Antwort           | Die Zeit bis zum ersten Token darf den Chat nicht spürbar bremsen (Ziel ca. 5 Sekunden, Annahme) |
| Embeddings | Gemini Embedding 2, `gemini-embedding-001` (je 768 Dimensionen)         | Trefferquote: liegt der passende Chunk in den Top 5, auch bei deutscher Frage auf englische Quelle  | Höhere Trefferquote, bei Gleichstand Embedding 2                                                 |
| Zitate     | Strukturierte Ausgabe mit Chunk-Nummern                                 | Anteil der Antworten mit gültigen, tragenden Zitaten                                                | Format und Prompt festlegen                                                                      |

**Entscheidung zum Umfang:** Es gibt keinen Vergleich mit OpenAI-Modellen, weil kein OpenAI-Zugang vorhanden ist. GPT-6 Luna bleibt als Alternative in der Stack-Tabelle und ist ungemessen. Das größere Flash-Modell läuft nur bei einer Stichprobe, weil es nur 20 Anfragen pro Tag gibt.

**Regeln:** Der Code ist Wegwerf-Code. Ergebnisse und Entscheidung landen als kurze Notiz im Repo und sind im Video zeigbar. Die 5 Dollar Guthaben gehen an den Anbieter, der gewinnt. Weil Modell-IDs und Limits in der Config stehen, ist ein späterer Wechsel nur eine Umgebungsvariable.

## Risiken und offene Punkte

Das größte Risiko ist das Free-Tier-Kontingent im Live-Demo. Danach folgen Parsing-Qualität und Latenz.

- **Kontingent:** Laut AI-Studio-Dashboard (Free Tier, im Spike geprüft) haben Gemini 3.5 bis 3.8 Flash 5 Anfragen pro Minute und 20 pro Tag, die Flash-Lite-Modelle 15 pro Minute und 500 pro Tag (beide 250K Tokens pro Minute). Das macht Studio auf den großen Modellen knapp. Fallback ist Flash-Lite.
- **Embeddings:** Gemini Embedding 2 hat 100 Anfragen pro Minute, 30K Tokens pro Minute und 1000 pro Tag (Dashboard). 30K Tokens pro Minute sind eng, Ingestion braucht Drosselung nach Tokens. Wie ein Batch gezählt wird und welche Limits `gemini-embedding-001` hat, ist nicht geprüft.
- **Latenz:** GPT-6 Luna (im Spike nicht gemessen) hatte laut Artificial Analysis bei Max-Reasoning eine Zeit bis zum ersten Token von etwa 139 Sekunden (Gemini 3.5 Flash-Lite etwa 8,8 Sekunden). Bei niedriger Stufe nicht gemessen.
- **Parsing per LLM** ist nicht deterministisch und kann auslassen. Gegenmittel: Stichprobentests und liteparse als Fallback.
- **ParseBench** stammt von LlamaIndex, deckt Enterprise-PDFs ab und enthält kein DOCX. Deshalb der eigene Spike.
- **Datennutzung im Free Tier:** Bedingungen lesen, Hinweis im Demo.
- **Hosting:** Kaltstart von etwa 1 Minute, kostenlose Bandbreite bei Render eingeschränkt.
- **Billing:** Unklar, ob Free-Kontingente nach dem Verknüpfen bleiben und ob das Guthaben hart begrenzt ist.
- **Preise und Benchmarks** aus Drittquellen vor dem Bau auf den offiziellen Seiten prüfen.
- **Take-home-Repos** sind nur Ideengeber: keinen Code kopieren.

## Tagesplan

Fünf Arbeitstage bis zur Abgabe, danach zwei Tage Puffer. Feature-Freeze ist am Abend von Tag 4, damit Tag 5 für Härtung, README und Video bleibt.

| Tag     | Ziel                 | Aufgaben                                                                                                                                                                | Ausgangskriterium                                   |
| ------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1       | Spike und Fundament  | Modell-Spike (halber Tag). Monorepo, CI, `AGENTS.md`, Setup aus notar-agent (erledigt, siehe oben), Config mit Limits, Schema und Migrationen, erstes Deployment (Hello World live) | Spike-Entscheidungen notiert, Deployment erreichbar |
| 2       | Ingestion            | Auth, Notebooks, Upload, Parsing, kanonischer Text mit Segmenten, Chunking mit Offsets, Embeddings, pg-boss-Jobs, Status in der UI                                      | PDF, DOCX und URL werden verarbeitet                |
| 3       | Chat und Zitate      | Hybrid-Retrieval mit RRF, Quellenauswahl, Streaming, Zitat-Chips, Hover-Popup, Quellenpanel mit Chunk-Hervorhebung                                                      | Frage stellen und per Klick zur Textstelle springen |
| 4       | Umfang komplettieren | Quellenübersicht, Vorschlagsfragen, Notizen, Chat-Konfiguration, Studio (Bericht, Karteikarten, Quiz), Fehler-, Lade- und Leerzustände                                  | Feature-Freeze am Abend                             |
| 5       | Härtung und Abgabe   | Tests, Eval-Skript, Quoten, SSRF-Schutz, README, Deployment-Check mit frischem Account, Beispiel-Notebook, Loom aufnehmen, abgeben                                      | E-Mail mit Repo, Live-Link und Loom verschickt      |
| 6 bis 7 | Puffer               | Nur Fehlerbehebung, keine neuen Funktionen                                                                                                                              | Nicht eingeplant                                    |

Die Mindmap kommt nur dazu, wenn Tag 4 früher fertig ist.

**Loom-Video (max. 10 Minuten):**

1. Eine Minute Ziel und Umfang.
2. Drei Minuten Vorgehen und Architektur, inklusive KI-Tool-Einsatz (AGENTS.md, Specs, Iterationen) und den Spike-Ergebnissen.
3. Vier Minuten Live-Test mit vorbereitetem Notebook. Vorher einmal komplett üben.
4. Eine Minute Trade-offs und "Wo würde es zuerst brechen und was würde ich dann ändern?".
