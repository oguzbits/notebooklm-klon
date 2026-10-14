# NotebookLM-Klon: Requirements, Stack und Risiken

Sep 29, 2026 · @Oguz Öztürk · Fakten zu Limits, Modellen und Kosten abgeglichen mit dem Code am 2026-10-14

## Ziel und Rahmen

Ziel ist ein NotebookLM-Klon in production-ready Qualität, abgegeben mit drei Artefakten: GitHub-Repo, Live-Deployment und ein Loom-Video von höchstens 10 Minuten, in dem du Vorgehen und Umsetzung erklärst und den Klon live testest.

- **Aufgabe:** Umsetzung, Umfang und Struktur sind frei, die Nutzung von AI-Tools ist ausdrücklich erwünscht.
- **Beweisziel:** Du beherrschst den Stack eines Full-Stack-Engineers (React, Node.js, PostgreSQL, API-Design, LLM-Integration).
- **Schwerpunkt:** AI-Kern (RAG, verifizierbare Zitate, Evals) und ein sichtbarer agentischer Workflow im Repo. Breite nur so weit nötig.
- **Zeit:** 4 bis 5 volle Arbeitstage, die Frist beträgt eine Woche. Ziel ist, früh fertig zu sein und den Rest als Puffer zu behalten.
- **Kosten:** minimal. Gebaut wurde im Gemini Free Tier; seit 2026-10-03 rechnet die Config mit den Limits des bezahlten Tarifs
  (siehe [Kontingent und Kosten](#kontingent-und-kosten)).
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
2. Quellen hinzufügen: PDF, DOCX, PPTX, Bilder, Aufnahmen (MP3, WAV), öffentliche YouTube-Videos, TXT/MD und URL. Die Verarbeitung läuft asynchron mit Status und verständlichen Fehlermeldungen.
3. Chat mit Streaming, der nur auf den gewählten Quellen antwortet, mit nummerierten Zitaten. Hover zeigt das Popup, Klick öffnet den Quelltext mit Chunk-Hervorhebung.
4. Quellen an- und abwählen. Die Auswahl begrenzt auch das Retrieval.
5. Quellenübersicht pro Quelle (Zusammenfassung und Schlüsselthemen).
6. Live-Deployment, README und ein Demo-Zugang mit vorbefülltem Demo-Notebook.

**Should** (umgesetzt: Vorschlagsfragen, Notizen)

- Vorschlagsfragen beim Hinzufügen einer Quelle.
- Notizen aus Antworten speichern.

**Runde 2: Nachbau (Stand 2026-09-30).** Die Oberfläche folgt NotebookLM so genau wie möglich, dreispaltig
(Quellen | Chat | Studio), mit Google Sans Flex (OFL) und den am Original gemessenen Farben, Rundungen und
Abständen (neutrales Grau, Blau nur als Akzent), hell und dunkel.
Logo und Name sind ausdrücklich erlaubt (Entscheidung des Nutzers); im Live-Demo steht ein Hinweis, dass es
ein Nachbau ist. Dazu:

- **Studio-Spalte:** Bericht (Briefing, FAQ, Lernleitfaden), Karteikarten, Quiz, Mindmap, Datentabelle (später ergänzt). Alle Ausgaben
  sind strukturiert, stützen sich auf die ausgewählten Quellen und folgen dem Zitat-Vertrag: Jeder
  Abschnitt, jede Karte, jede Frage, jede Zelle der Datentabelle und jeder Ast verweist auf echte Passagen, der Server verwirft, was
  nicht belegt ist. Notizen wohnen wie bei NotebookLM in der Studio-Spalte.
- **Chat-Einstellungen pro Notizbuch:** Stil (Standard, Lernbegleiter, eigene Anweisung), Antwortlänge,
  Ausgabesprache (Standard: Sprache der Frage).
- **Kleine NotebookLM-Funktionen:** Text einfügen als Quelle, Notiz in Quelle umwandeln, Antwort kopieren.
- **Modelle:** Alle Modell-IDs kommen aus der Umgebung (`AI_MODEL`, `PARSE_MODEL`, `EMBEDDING_MODEL`). Chat, Studio und Übersichten
  nutzen dasselbe `AI_MODEL`; ein eigenes Studio-Modell gibt es nicht.

**Stretch**

- PPTX, Aufnahmen (MP3, WAV) und YouTube als Quelle (gebaut).
- Websuche im Chat (Tavily, optional, ohne Deep Research) und Gastzugang mit einer Kopie des Demo-Notizbuchs (gebaut).

**Bewusst nicht**

- Audio- und Video-Overview, Infografik, Präsentation, Deep Research.
- Später ergänzt (Runde 4): eine schnelle Websuche mit Tavily (ohne Deep Research) und ein Titelbild im S3-Speicher.
- Sharing und Kollaboration, Drive-Anbindung. Eine eigene Handy-App entfällt; die Seite selbst hat ein Handy-Layout (Tabs).
- Originaldateien speichern (nur extrahierter Text plus Metadaten).

**Qualitätsanforderungen (production-ready)**

- SSRF-Schutz beim URL-Import, Upload-Limits (Größe, Seitenzahl) und Rate Limiting gegenüber dem Anbieter. Quoten pro Nutzer
  wurden gebaut und am 2026-10-03 auf Entscheidung des Nutzers wieder entfernt; der Plan dazu: [Plan 7](plans/07-nutzung-und-kosten.md).
- Env-Validierung mit Zod, Health-Check, strukturierte Logs, Migrationen mit drizzle-kit.
- Tests: Vitest, Playwright-Nutzerreisen, ein Eval-Skript mit Golden-Fragen. Tests laufen ohne echte API-Aufrufe (Fixtures und Mocks), damit sie kein Tageskontingent verbrauchen.
- CI mit Typecheck, Lint und Tests, dazu eine AGENTS.md, die deinen agentischen Workflow im Repo sichtbar macht.

## Architektur und Datenfluss

Die Ingestion schreibt Chunks und Vektoren in Postgres, der Chat liest nur die passenden Chunks der gewählten Quellen, das Studio lädt die gewählten Quellen vollständig.

## Tech Stack v3

React-Frontend und Node.js-Backend in einem Monorepo, ein Container, Postgres mit pgvector, Gemini im Free Tier. Docling und ein zweiter Service entfallen. Preise und Benchmarks stammen teils aus Drittquellen (Stand 29.09.2026) und sind vor dem Bau zu prüfen.

| Bereich          | Wahl                                                                                                                      | Begründung / Alternative                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Runtime, Sprache | Node.js LTS, pnpm-Workspaces, TypeScript strict, Zod in `packages/shared`                                                 | Die Anforderungen nennen Node.js und JavaScript. Bun bewusst nicht                                                           |
| Frontend         | React 19, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, react-markdown                                         | Anzeige nennt React. Ein getrenntes Frontend zeigt API-Design sichtbar                                                     |
| Backend          | Hono mit `@hono/zod-openapi`, SSE-Streaming, liefert auch das Frontend aus                                                | Typisierter RPC-Client und OpenAPI aus Zod-Schemas. Fastify, Express oder NestJS wären gleichwertig, Hono ist austauschbar |
| Auth             | Better Auth mit Drizzle-Adapter                                                                                           | Nutzer in der eigenen Postgres. Supabase Auth bringt bei direkter DB-Verbindung keinen RLS-Vorteil                         |
| Datenbank        | PostgreSQL mit pgvector (HNSW), Postgres-Volltextsuche, Drizzle ORM; in Produktion ein Container auf dem Hetzner-Server | Eine Datenbank für alles; Neon und Render-Postgres verworfen (schlafen im Gratis-Tarif ein beziehungsweise laufen nach 30 Tagen ab)               |
| Jobs             | pg-boss                                                                                                                   | Etablierte Postgres-Queue statt Eigenbau. Braucht eine direkte Verbindung, kein PgBouncer                                                    |
| Parsing          | PDF: Gemini 3.1 Flash-Lite (Spike entschieden, [Ergebnisse](SPIKE-ERGEBNISSE.md)). DOCX: mammoth. PPTX: fflate + XML (Folientext, Tabellen, Notizen). Audio: Gemini transkribiert wörtlich (inline, bis 10 MB). TXT/MD direkt. URL: Readability. DOCX und URL werden als Markdown gespeichert (Links, Fett, Tabellen), TXT bleibt Klartext. Fallback bei Recitation-Sperre: ein zweites Gemini-Modell (`PARSE_FALLBACK_MODEL`), kein liteparse | ParseBench (Tabellen / Inhaltstreue): Gemini 3.1 Flash-Lite 85,5 / 89,5, Docling 66,4 / 66,9, LiteParse 42,4 / 70,0        |
| Embeddings       | Gemini Embedding 2 mit 768 Dimensionen (`EMBEDDING_MODEL`); ein Fallback-Modell gibt es nicht                                                  | Limits bekannt (RPM 100, TPM 30K, RPD 1000), im Spike gleichauf mit 001 (17 gegen 16 von 18). Die Vektorräume beider Modelle sind inkompatibel                              |
| Retrieval        | pgvector plus Volltextsuche, Fusion per RRF in SQL                                                                        | Hybrid fängt Eigennamen und Zahlen, die Vektorsuche verfehlt (im Spike ein Fehltreffer, der zu einer falschen Antwort führte)                                                               |
| LLM-Schicht      | Eigener schlanker Gemini-Client statt Vercel AI SDK, Modell-IDs und Limits in der Config                                                                        | Chat: Gemini 3.5 Flash-Lite (Spike entschieden, GPT-6 Luna ungemessen). Studio und Übersichten: dasselbe Modell  |
| Zitate           | Strukturierte Ausgabe mit Chunk-Nummern, Server prüft, dass die zitierten Chunks im Kontext waren                         | Anthropic-Citations verworfen (Kosten, Anbieter-Bindung)                                                                   |
| Tests, Qualität  | Vitest, Playwright-Nutzerreisen, Eval-Skript, ESLint, Prettier, GitHub Actions                                                   | Tests ohne echte API-Aufrufe                                                                                               |
| Hosting          | Hetzner Cloud: Docker Compose mit Caddy, App, Postgres und SeaweedFS, Deployment per GitHub Actions ([DEPLOYMENT.md](DEPLOYMENT.md)); live seit 2026-10-02 | Läuft dauerhaft, kein Kaltstart. Render und Vercel verworfen                                  |

**Abgrenzung zu notar-agent:** Übernommen werden Zod, Drizzle, pgvector und das Hybrid-Retrieval mit RRF. Neu bzw. geändert sind Auth, Queue (pg-boss statt Eigenbau), Parsing (Gemini statt liteparse plus mammoth für alles) und der Verzicht auf Supabase.

**Setup aus notar-agent (übernommen und angepasst):** Regeln und Schichten stehen in [AGENTS.md](../AGENTS.md), die Gates in `package.json` (`pnpm check`, `pnpm test`) und im CI (`.github/workflows`), die Hook-Regeln in `.claude/settings.json` und `.claude/hooks`. Hier steht nur, was von notar-agent abweicht:

- **Gate `check`:** ohne Health-Score. Er startete die Einzeltools ein zweites Mal und ließ Abstürze als 100 Punkte durch; die Einzeltools sind schon harte Gates.
- **TypeScript:** 6.0, weil typescript-eslint TypeScript 7 noch nicht unterstützt.
- **Neu:** Env-Validierung mit Zod (`apps/api/src/config/env.ts`), Netzwerk-Riegel in Tests (MSW lehnt jede nicht abgefangene Anfrage ab), Tests für die Hook-Skripte selbst, Docs-Audit (`pnpm audit:docs`).
- **Skills und MCP:** chrome-devtools läuft als MCP-Server auf Benutzerebene, nicht im Repo. `software-craftsmanship` und `context7` entfallen, weil `AGENTS.md`, ESLint und die Audits dieselben Regeln erzwingen.
- **Eval:** Übernommen ist die Idee, keine Zeile Code. Dataset-Schema mit Textankern statt Chunk-IDs, reine Scorer, aufgezeichnete Modellantworten offline abgespielt; Promptfoo, der Jev-Judge und ein Mock-Modell aus der Ground Truth entfallen, weil sie nur die Verdrahtung prüften, nicht die Qualität. Aufbau: [Plan 3](plans/03-eval.md).

**Nicht übernommen:** Supabase-RLS und -Repositories (Autorisierung liegt in der API), Next.js-Route-Handler, Audit-Trail mit Hash-Kette, Wissensdatenbank der Rechtsnormen, PII-Logging-Scan (§ 203 StGB), Supabase-N+1-Scan, Health-Score, promptfoo und die Fixture-Generatoren für Notar-Scans.

## Kontingent und Kosten

**Was gilt heute** (Quelle ist der Code, nicht diese Seite): Die Limits der Anbieter stehen in `PROVIDER_LIMITS` und die eigenen
Grenzen in `LIMITS`, beide in [config/limits.ts](../apps/api/src/config/limits.ts). `PROVIDER_LIMITS` enthält die Werte des
bezahlten Tarifs aus dem AI-Studio-Dashboard (Stand 2026-10-03). ❓ Ob die Abrechnung verknüpft ist und ein Budget-Limit gesetzt
wurde, steht nirgends im Repo.

**Schutz vor Kosten und Missbrauch, wie gebaut**

- **Rate-Limiter vor dem Anbieter:** Jeder Aufruf an ein Sprach- oder Embedding-Modell läuft durch einen Gleitfenster-Limiter
  (Anfragen und Tokens pro Minute, in einer Warteschlange). Er liegt im Speicher: Ein Neustart setzt ihn zurück, mehrere
  Instanzen würden getrennt zählen. Er schützt das Kontingent beim Anbieter, nicht vor einzelnen Nutzern.
- **Inhalts-Hash pro Nutzer:** Dasselbe Dokument wird nie zweimal gelesen oder eingebettet.
- **Upload:** höchstens 10 MB, PDFs höchstens 50 Seiten; URL-Import höchstens 5 MB.
- **Gäste:** höchstens 20 neue pro Stunde für alle zusammen, 200 gleichzeitig, 7 Tage Lebensdauer.
- **Websuche** (Tavily): eigenes Limit entfernt; eine erschöpfte Tavily-Quote wird als 429 weitergereicht.
- **Kein Limit pro Nutzer** für Chat, Studio, Quellen oder Notizbücher. Entscheidung des Nutzers vom 2026-10-03 (Commit `e1051e2`).
  Die Folge und die offenen Fragen dazu: [Plan 7](plans/07-nutzung-und-kosten.md).
- **Kill-Switch** per Umgebungsvariable: nicht gebaut; wer alles sperren will, stoppt den Container.

**Zwei Google-Projekte:** eines zum Bauen und Testen, eines für das Live-Demo, damit Tests das Kontingent der Prüfer nicht
verbrauchen ([DEPLOYMENT.md](DEPLOYMENT.md)).

**Hinweis im Demo:** keine sensiblen Dokumente hochladen; für das Free Tier können Google-Bedingungen zur Datennutzung gelten.

**Free Tier beim Bau (Stand 2026-09-29, aus der AI-Studio-Konsole, nur noch als Verlauf):** Gemini 3.1/3.5 Flash-Lite 15 Anfragen pro
Minute und 500 pro Tag, 3.5 bis 3.8 Flash 5 pro Minute und 20 pro Tag, Embedding 2 100 pro Minute, 30K Tokens pro Minute und 1000
pro Tag. Die Limits gelten pro Projekt, nicht pro Key. Das war der Grund für die Drosselung im Worker und für die Lite-Modelle im Dev.

## Risiken und offene Punkte

Das größte Risiko sind Kosten und Kontingent im Live-Demo, weil kein Limit pro Nutzer gilt ([Plan 7](plans/07-nutzung-und-kosten.md)). Danach folgen Parsing-Qualität und Latenz.

- **Kontingent und Kosten:** ein einzelner Nutzer oder Gast kann das gemeinsame Kontingent und das Budget aufbrauchen. Es gibt keine Verbrauchszählung pro Nutzer ([Plan 7](plans/07-nutzung-und-kosten.md)).
- **Embeddings:** Der Limiter drosselt nach geschätzten Tokens. Wie der Anbieter einen Batch zählt, ist nicht geprüft.
- **Latenz:** GPT-6 Luna (im Spike nicht gemessen) hatte laut Artificial Analysis bei Max-Reasoning eine Zeit bis zum ersten Token von etwa 139 Sekunden (Gemini 3.5 Flash-Lite etwa 8,8 Sekunden). Bei niedriger Stufe nicht gemessen.
- **Parsing per LLM** ist nicht deterministisch und kann auslassen. Gegenmittel: Stichprobentests; ein liteparse-Fallback wurde nicht gebaut.
- **ParseBench** stammt von LlamaIndex, deckt Enterprise-PDFs ab und enthält kein DOCX. Deshalb der eigene Spike.
- **Datennutzung im Free Tier:** Bedingungen lesen, Hinweis im Demo.
- **Hosting:** Läuft seit 2026-10-02 auf einem Hetzner-Server; Deploy mit Dump, Health-Prüfung und Rollback ist im Betrieb erprobt.
- **Billing:** ❓ Ob ein hartes Budget-Limit gesetzt ist und ob eine automatische Aufladung läuft, ist nicht belegt.
- **Preise und Benchmarks** aus Drittquellen vor dem Bau auf den offiziellen Seiten prüfen.
- **Take-home-Repos** sind nur Ideengeber: keinen Code kopieren.
