# NotebookLM-Klon

Ein Notebook, das nur auf deinen eigenen Quellen antwortet und jede Aussage mit einer Nummer belegt. Ein Klick auf die Nummer öffnet den Quelltext an der zitierten Stelle.

Bewerbungsaufgabe für Everlast AI (zweite Runde). Der Schwerpunkt liegt auf dem Weg von der Quelle zum nachprüfbaren Zitat: Aufnahme, Suche, Antwort mit geprüften Zitaten, Auswertung. Die Oberfläche ist deutsch, Quellen und Fragen dürfen englisch sein.

|             |                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live-Demo   | _wird nach dem Deployment eingetragen_                                                                                                                           |
| Demo-Zugang | Auf der Anmeldeseite **„Demo ausprobieren“**: ein Gastkonto mit einer eigenen Kopie des Demo-Notebooks, ohne E-Mail und Passwort. Es wird nach 7 Tagen gelöscht. |
| Video       | _Loom-Link folgt_                                                                                                                                                |

> Hinweis für die Demo: Keine sensiblen Dokumente hochladen. Im kostenlosen Tarif von Google können Eingaben zur Verbesserung der Modelle genutzt werden. Die Demo soll auf einem Hetzner-Server laufen und schläft dort nicht ein (siehe Abschnitt „Deployment“).

## Was es kann

- **Anmelden und Notebooks** anlegen, öffnen, löschen (E-Mail und Passwort, Sitzung in der eigenen Datenbank).
- **Quellen** hinzufügen: PDF, DOCX, TXT, MD und Webseiten per Link. Die Verarbeitung läuft im Hintergrund mit sichtbarem Status und verständlichen Fehlermeldungen. Quellen lassen sich an- und abwählen, die Auswahl begrenzt auch die Suche.
- **Chat** mit Streaming. Jede aussagekräftige Antwort besteht aus Aussagen mit nummerierten Chips. Hover zeigt die Textstelle mit Quellenname, Klick öffnet den Quelltext mit hervorgehobenem Abschnitt.
- **Übersicht pro Quelle**: Zusammenfassung, Schlüsselthemen und Vorschlagsfragen, die das Gespräch starten.
- **Übersicht des Notebooks** am Anfang des Chats: ein Emoji, der Titel, die Zahl der Quellen und eine Zusammenfassung aller fertigen Quellen mit fetten Schlüsselbegriffen. Sie entsteht einmal, wenn sich die Quellen ändern, und lässt sich als Notiz speichern oder kopieren.
- **Notizen** aus Antworten, mit erhaltenen Zitaten, und eigene Notizen mit Editor (Format-Leiste, wird beim Tippen gespeichert, auf Wunsch als Quelle).
- **Studio**: Bericht (Briefing, FAQ, Lernleitfaden, Blogbeitrag oder eigene Anweisung), Karteikarten, Quiz, Mindmap und Datentabelle aus den gewählten Quellen. Vor dem Erzeugen lassen sich Umfang und Schwierigkeit wählen; die Ausgaben tragen dieselben geprüften Zitate wie der Chat.
- **Suche im Web** unter „Quellen hinzufügen“: Treffer ansehen und als Quelle übernehmen (Tavily, optional, mit Grenzen pro Nutzer und Tag).
- **Notebook anpassen**: Titel, eigene Zusammenfassung und Titelbild (liegt in einem S3-kompatiblen Speicher, optional). Notebooks lassen sich kopieren, auf der Startseite anpinnen und umbenennen.
- **Quellen und Ausgaben** sortieren und umbenennen; der Chat hat „Nach unten springen“ und zeigt je Antwort das **Vorgehen** (wie viele Quellen und Stellen geprüft wurden).
- **Chat-Konfiguration** pro Notebook und Vorschlagsfragen unter der letzten Antwort.
- **Verlauf** bleibt pro Notebook erhalten, gegliedert nach Tagen.

Nicht gebaut (siehe [docs/PLAN.md](docs/PLAN.md), Kategorien Should und Stretch): Audio, Präsentation, Video und Infografik im Studio, PPTX als Quelle, agentische Suche im Chat, Deep Research, Drive-Anbindung, Bewertung von Chat-Antworten (Daumen). Der Umfang wurde bewusst auf die Kernstrecke begrenzt, die Gründe stehen in [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).

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

Das Diagramm zeigt die geplante Produktion (noch nicht live, siehe „Deployment“); lokal laufen Postgres und der Speicher aus `pnpm db:up`. Das Frontend wird vom selben Prozess ausgeliefert wie die API (`WEB_DIST_DIR`), im Entwicklungsbetrieb leitet Vite `/api` weiter. Es gibt deshalb nur eine Origin, kein CORS und keine zweite Liste vertrauter Adressen.

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

Die Entscheidungen mit Zahlen stehen im Repository, damit sie im Video zeigbar sind:

- [docs/SPIKE-ERGEBNISSE.md](docs/SPIKE-ERGEBNISSE.md): Modell-Spike zu PDF-Parsing, Einbettungen, Chat und Zitat-Format, dazu die Hybridsuche.
- [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md): kleine Entscheidungen mit Begründung und was sie später ändern würde.
- [docs/PLAN.md](docs/PLAN.md): Anforderungen, Stack, Kostenstrategie und Risiken.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Einrichtung, Betrieb und Wiederherstellung auf dem Hetzner-Server.

Kurz: PDFs liest ein Gemini-Modell (Tabellen und Scans bleiben erhalten), die Suche ist ein Hybrid aus Vektor und Volltext in einer SQL-Abfrage, Zitate sind chunk-genau, weil auch NotebookLM ganze Absätze hervorhebt. Der Stack ist bewusst klein: eine Datenbank für alles, ein Container.

## Qualitätssicherung

- `pnpm check`: TypeScript strict, ESLint, Architekturregeln, tote Abhängigkeiten, Duplikate (unter 2 %), Magic-String-Audit.
- `pnpm test`: Vitest ohne Netzwerk. MSW lehnt jede nicht abgefangene Anfrage ab, kein Test kann Kontingent verbrauchen.
- `pnpm test:db`: Tests gegen Postgres mit pgvector (`pnpm db:up`), darunter alle Zugriffsregeln: jede Abfrage filtert nach Nutzer, Notebook und gewählten Quellen.
- `pnpm e2e`: Playwright-Nutzerreisen gegen den Offline-Server (Konto, Notebooks, Quellen, Trennung der Konten, Studio mit Quiz, Mindmap und Bericht, Darstellung auf dem Telefon; echte Datenbank, echte App, gefälschte Modelle, keine Token).
- `pnpm eval:live`: die 18 Golden Questions gegen die echten Modelle, mit Trefferquote der Suche, Fakten in der Antwort und im zitierten Abschnitt und der Zahl der vom Server verworfenen Aussagen. Kostet Kontingent, läuft nicht in CI.
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

Suche im Web (optional): `TAVILY_API_KEY` setzen (Tavily, kostenloser Tarif mit 1000 Suchen im Monat; an Tavily gehen nur die Suchbegriffe). Ohne Schlüssel zeigt die Oberfläche das Suchfeld nicht. Pro Nutzer sind 10 Suchen pro Stunde und für alle zusammen 30 pro Tag erlaubt.

Titelbilder (optional): Ein S3-kompatibler Speicher, dazu `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` und `S3_SECRET_ACCESS_KEY` setzen (alle vier oder keins). Lokal startet `pnpm db:up` einen (SeaweedFS). Ohne Speicher zeigt der Dialog „Notebook anpassen“ keine Bildfläche. Die Bilder liegen im Speicher, nicht in der Datenbank: Der lokale Dienst aus `pnpm db:up` hält die Bilder nur im Arbeitsspeicher (`tmpfs`): nach `pnpm db:down` sind sie weg. Bei einem Docker-Volume (Deployment) sind sie dauerhaft, aber nicht gesichert.

Demo-Notebook anlegen (braucht den Schlüssel, liest drei Beispieldokumente einmal ein): `SEED_DEMO_EMAIL` und `SEED_DEMO_PASSWORD` setzen, dann `pnpm seed:demo`. Der Befehl kann wiederholt werden. Gäste („Demo ausprobieren“) bekommen eine Kopie dieses Notebooks, dafür muss `SEED_DEMO_EMAIL` auch in der Umgebung der App stehen.

## Deployment

> Stand: Es ist noch nichts deployt. Vorbereitet ist ein Hetzner-Server. Begründung: [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md), Abschnitt „Deployment: Entscheidung und Stand“.

Die vollständige Anleitung (Einrichtung, Betrieb, Backup, Fehlersuche) steht in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

- **Hetzner Cloud** (Docker Compose, Caddy). Dateien in [deploy/](deploy/): [docker-compose.prod.yml](deploy/docker-compose.prod.yml) (Caddy mit automatischem HTTPS, App, Postgres mit pgvector, SeaweedFS für die Titelbilder), [Caddyfile](deploy/Caddyfile), [bootstrap.sh](deploy/bootstrap.sh), [backup.sh](deploy/backup.sh). Der Workflow [deploy.yml](.github/workflows/deploy.yml) baut das Image, schickt es per SSH an den Server und startet den Stack, sobald CI auf `main` grün ist.

## Wo es zuerst brechen würde

- **Kontingent des Anbieters.** Im kostenlosen Tarif sind die Tageslimits knapp. Gegenmittel im Code: Inhalts-Hash statt doppelter Verarbeitung, Ratenbegrenzer mit Token-Gewichten, Kontingent pro Nutzer, vorbefülltes Demo-Notebook.
- **Suche bei Fragen in anderer Sprache als die Quelle.** Die Textseite der Hybridsuche liefert dort nur Rauschen, das Gewicht 0,5 ist nicht durch Messung begründet (siehe Nachtrag in den Spike-Ergebnissen). Mit mehr Golden Questions neu bewerten.
- **PDF-Parsing per Sprachmodell** ist nicht deterministisch und kann Bildunterschriften auslassen. Ein Abgleich mit einem lokalen Parser wäre der nächste Schritt.
- **Mehrere Instanzen.** Die Ratenbegrenzer liegen im Speicher eines Prozesses. Bei mehr als einer Instanz müssten sie in die Datenbank.

## Agentischer Workflow

Die Arbeit mit Coding-Agenten ist im Repository sichtbar: [AGENTS.md](AGENTS.md) (Regeln, Schichten, Produkt-Invarianten, Definition of Done), Hooks unter `.claude/` (blockierte Befehle, Geheimnisschutz, Gate vor dem Beenden), Husky-Hooks und die Commit-Historie mit einem Thema pro Commit. Tests entstehen vor dem Code, Entscheidungen werden in [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md) protokolliert.
