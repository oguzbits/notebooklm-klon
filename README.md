# NotebookLM-Klon

Ein Notebook, das nur auf deinen eigenen Quellen antwortet und jede Aussage mit einer Nummer belegt. Ein Klick auf die Nummer öffnet den Quelltext an der zitierten Stelle.

Nachbau von NotebookLM. Der Schwerpunkt liegt auf dem Weg von der Quelle zum nachprüfbaren Zitat: Aufnahme, Suche, Antwort mit geprüften Zitaten, Auswertung. Die Oberfläche ist deutsch, Quellen und Fragen dürfen englisch sein.

|             |                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live-Demo   | https://128-140-11-37.sslip.io                                                                                                                                   |
| Demo-Zugang | Auf der Anmeldeseite **„Demo ausprobieren“**: ein Gastkonto mit einer eigenen Kopie des Demo-Notebooks, ohne E-Mail und Passwort. Es wird nach 7 Tagen gelöscht. |
| Video       | _Loom-Link folgt_                                                                                                                                                |

> Keine sensiblen Dokumente hochladen: Im kostenlosen Tarif von Google können Eingaben zur Verbesserung der Modelle genutzt werden.

## Was es kann

- **Notebooks und Quellen:** PDF, DOCX, PPTX, Bilder, Aufnahmen (MP3, WAV), TXT, MD und Webseiten per Link, mit Status im Hintergrund. Die Auswahl der Quellen begrenzt auch die Suche. Websuche über Tavily ist optional.
- **Chat** mit Streaming: Jede Aussage trägt nummerierte Chips, Hover zeigt die Textstelle, Klick öffnet den Quelltext mit hervorgehobenem Abschnitt. Der Verlauf bleibt pro Notebook erhalten.
- **Übersichten** pro Quelle und pro Notebook mit Vorschlagsfragen.
- **Notizen** aus Antworten (Zitate bleiben erhalten) und eigene Notizen mit Editor, auf Wunsch als Quelle.
- **Studio:** Bericht (Briefing, FAQ, Lernleitfaden, Blogbeitrag, eigene Anweisung), Karteikarten, Quiz, Mindmap und Datentabelle, mit denselben geprüften Zitaten.
- **Notebook anpassen:** Titel, Zusammenfassung, Titelbild, kopieren, anpinnen.

Nicht gebaut: Audio, Präsentation, Video und Infografik im Studio, agentische Suche, Deep Research, Drive-Anbindung, Bewertung von Antworten. Gründe: [docs/PLAN.md](docs/PLAN.md) und [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).

## Architektur

```mermaid
flowchart LR
  subgraph Browser
    Web["React 19<br/>TanStack Query, shadcn"]
  end
  subgraph Server["Hetzner-Server (Docker Compose)"]
    Caddy["Caddy<br/>HTTPS"]
    subgraph Container["App-Container"]
      Api["Hono API<br/>Zod-Schemas aus packages/shared"]
      Worker["Ingestion-Worker<br/>pg-boss"]
    end
    DB[("PostgreSQL mit pgvector<br/>Volltextsuche, Sitzungen,<br/>Job-Queue")]
    S3[("SeaweedFS (S3-kompatibel)<br/>Titelbilder (optional)")]
  end
  Gemini["Gemini API<br/>PDF lesen, Einbettungen, Antwort"]
  Tavily["Tavily<br/>Websuche (optional)"]

  Web -- "HTTPS" --> Caddy
  Caddy -- "HTTP + SSE, eine Origin" --> Api
  Api --> DB
  Api -- "Antwort streamen" --> Gemini
  Api -- "nur Suchbegriffe" --> Tavily
  Api --> S3
  Worker --> DB
  Worker -- "PDF lesen, einbetten" --> Gemini
```

Das Frontend wird vom selben Prozess ausgeliefert wie die API (`WEB_DIST_DIR`), im Entwicklungsbetrieb leitet Vite `/api` weiter. Lokal laufen Postgres und der Speicher aus `pnpm db:up`.

### Schichten

Die Regeln stehen in [AGENTS.md](AGENTS.md) und werden von `pnpm check` erzwungen (dependency-cruiser, ESLint, knip, jscpd).

- `packages/shared`: nur Zod-Schemas, abgeleitete Typen und `as const`-Wörterbücher. Einzige Quelle der Wahrheit für jeden Vertrag zwischen API und Web, auch für das Zitat-Schema.
- `apps/api/src/core`: reine Logik ohne Ein- und Ausgabe (Chunking, Zitatprüfung, Kontextaufbau, SSRF-Regeln). Routen sind dünne Adapter, Datenbank, Jobs und Anbieter liegen dahinter.
- `apps/web`: React, Serverzustand nur über TanStack Query. Der Web-Code importiert aus der API nur den Typ `AppType` für den Hono-RPC-Client.

### Aufnahme einer Quelle

```mermaid
sequenceDiagram
  participant U as Nutzer
  participant A as API
  participant Q as Job-Queue
  participant W as Worker
  participant G as Gemini
  participant D as PostgreSQL
  U->>A: Datei oder Link
  A->>A: Typ und Größe prüfen, SHA-256 des Inhalts
  alt Inhalt schon vorhanden
    A-->>U: vorhandene Quelle wiederverwenden
  else neuer Inhalt
    A->>Q: Job anlegen
    A-->>U: 202, Status "Wartet"
    Q->>W: Job
    W->>G: PDF lesen (Bilder, Tabellen)
    W->>W: kanonischer Text, Abschnitte mit Offsets
    W->>G: Einbettungen in Paketen
    W->>D: Text, Abschnitte, Vektoren in einer Transaktion
    U->>A: Status abfragen
    A-->>U: "Bereit"
  end
```

### Antwort mit geprüften Zitaten

```mermaid
sequenceDiagram
  participant U as Nutzer
  participant A as API
  participant D as PostgreSQL
  participant G as Gemini
  U->>A: Frage
  A->>G: Frage einbetten
  A->>D: Hybridsuche (Vektor + Volltext, RRF) nach Nutzer, Notebook, gewählten Quellen
  D-->>A: 8 Abschnitte
  A->>G: Abschnitte als c1 bis c8 und Frage, strukturierte Ausgabe
  loop je Aussage, sobald sie fertig ist
    G-->>A: Aussage mit Labels
    A->>A: Labels auf echte IDs abbilden, nicht gezeigte verwerfen
    A-->>U: Aussage mit Chunk-IDs (SSE)
  end
  A->>D: Frage und Antwort speichern
```

Das Modell sieht nur kurze Labels pro Anfrage. Der Server bildet sie auf echte Abschnitt-IDs ab und entfernt jede Aussage ohne gültiges Zitat. Ein Zitat auf etwas, das dem Modell nie gezeigt wurde, ist so nicht möglich. Ein gültiges Zitat ist trotzdem kein Beleg für eine richtige Antwort; darum wird beides getrennt gemessen (siehe Auswertung).

## Was ich entschieden habe und warum

Entscheidungen mit Zahlen: [Spike-Ergebnisse](docs/SPIKE-ERGEBNISSE.md) (PDF-Parsing, Einbettungen, Chat, Zitat-Format, Hybridsuche), [Entscheidungen](docs/ENTSCHEIDUNGEN.md) (Begründungen), [Plan](docs/PLAN.md) (Anforderungen, Stack, Risiken).

## Qualitätssicherung

- `pnpm check`: TypeScript strict, ESLint, Architekturregeln, tote Abhängigkeiten, Duplikate (unter 2 %), Magic-String-Audit.
- `pnpm test`: Vitest ohne Netzwerk. MSW lehnt jede nicht abgefangene Anfrage ab, kein Test kann Kontingent verbrauchen.
- `pnpm test:db`: Tests gegen Postgres mit pgvector (`pnpm db:up`), darunter alle Zugriffsregeln: jede Abfrage filtert nach Nutzer, Notebook und gewählten Quellen.
- `pnpm e2e`: Playwright-Nutzerreisen gegen den Offline-Server (echte App und Datenbank, gefälschte Modelle).
- `pnpm eval:live`: 18 Golden Questions gegen die echten Modelle (Trefferquote, Fakten, verworfene Aussagen). Kostet Kontingent, läuft nicht in CI.
- CI (GitHub Actions): Qualität, Unit-Tests, Datenbank-Tests, Browser-Test, Build, Semgrep.

Weitere Regeln, die im Code geprüft sind: SSRF-Schutz beim Link-Import (nur http und https, DNS-Auflösung, keine privaten Adressen, nach jeder Weiterleitung erneut), Größen- und Seitenlimits, Kontingent pro Nutzer, Ratenbegrenzung aller Modellaufrufe, keine Dokumentinhalte in Logs.

## Lokal starten

Voraussetzungen: Node 24, pnpm, Docker.

```bash
pnpm install
pnpm db:up                        # Postgres mit pgvector auf Port 54329
cp .env.example .env.local        # Werte eintragen, siehe unten
pnpm dev                          # API auf :3000 und Web auf :5173 zusammen, Web leitet /api an die API weiter
```

Einzeln geht es auch: `pnpm --filter @nlm/api dev` und `pnpm --filter @nlm/web dev`.

In `.env.local` (Vorlage: [.env.example](.env.example)) sind nötig: `GEMINI_API_KEY`, die drei Modell-IDs `AI_MODEL`, `PARSE_MODEL`, `EMBEDDING_MODEL`, `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) und `BETTER_AUTH_URL` (`http://localhost:5173`). Die Modell-IDs stehen nie im Code, ein Wechsel ist eine Umgebungsvariable. Optional ist `PARSE_FALLBACK_MODEL`: ein größeres Modell für PDFs, die `PARSE_MODEL` als Wiedergabe geschützten Textes ablehnt (`RECITATION`). Die im Spike gewählten Modelle stehen in [docs/SPIKE-ERGEBNISSE.md](docs/SPIKE-ERGEBNISSE.md).

Ohne API-Schlüssel geht es mit dem Offline-Server: die echte App und Datenbank, aber ein Modell, das den ersten Satz der besten Textstellen zitiert (PDFs lassen sich dort nicht lesen).

```bash
DATABASE_URL=postgresql://nlm:nlm@localhost:54329/nlm_e2e \
BETTER_AUTH_SECRET=lokal-nur-zum-ausprobieren-0123456789 \
BETTER_AUTH_URL=http://localhost:5173 \
pnpm --filter @nlm/api dev:offline   # dazu in einem zweiten Terminal: pnpm --filter @nlm/web dev
```

Suche im Web (optional): `TAVILY_API_KEY` setzen. Ohne Schlüssel zeigt die Oberfläche das Suchfeld nicht.

Titelbilder (optional): Ein S3-kompatibler Speicher, dazu `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` und `S3_SECRET_ACCESS_KEY` setzen (alle vier oder keins). Lokal startet `pnpm db:up` einen (SeaweedFS), der die Bilder nur im Arbeitsspeicher hält.

Demo-Notebook anlegen (braucht den Schlüssel, liest drei Beispieldokumente einmal ein): `SEED_DEMO_EMAIL` und `SEED_DEMO_PASSWORD` setzen, dann `pnpm seed:demo`. Der Befehl kann wiederholt werden. Gäste („Demo ausprobieren“) bekommen eine Kopie dieses Notebooks, dafür muss `SEED_DEMO_EMAIL` auch in der Umgebung der App stehen.

## Deployment

Hetzner Cloud mit Docker Compose und Caddy (automatisches HTTPS). [deploy.yml](.github/workflows/deploy.yml) baut das Image und startet den Stack per SSH, sobald CI auf `main` grün ist. Einrichtung, Betrieb, Backup und Fehlersuche: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Wo es zuerst brechen würde

- **Kontingent des Anbieters.** Im kostenlosen Tarif sind die Tageslimits knapp. Gegenmittel im Code: Inhalts-Hash statt doppelter Verarbeitung, Ratenbegrenzer mit Token-Gewichten, Kontingent pro Nutzer, vorbefülltes Demo-Notebook.
- **Suche bei Fragen in anderer Sprache als die Quelle.** Die Textseite der Hybridsuche liefert dort nur Rauschen, das Gewicht 0,5 ist nicht durch Messung begründet (siehe Nachtrag in den Spike-Ergebnissen). Mit mehr Golden Questions neu bewerten.
- **PDF-Parsing per Sprachmodell** ist nicht deterministisch und kann Bildunterschriften auslassen. Manche PDFs (gemessen: das NIST-Dokument im Lasttest) lehnt das Modell als Wiedergabe geschützten Textes ab (`RECITATION`), auch das größere Fallback-Modell nicht immer; die Quelle meldet dann einen Fehler. Ein Abgleich mit einem lokalen Parser wäre der nächste Schritt.
- **Mehrere Instanzen.** Die Ratenbegrenzer liegen im Speicher eines Prozesses. Bei mehr als einer Instanz müssten sie in die Datenbank.

## Agentischer Workflow

[AGENTS.md](AGENTS.md) (Regeln, Schichten, Invarianten, Definition of Done), Hooks unter `.claude/` (blockierte Befehle, Geheimnisschutz, Gate vor dem Beenden), Husky-Hooks und ein Thema pro Commit. Tests entstehen vor dem Code, Entscheidungen stehen in [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).
