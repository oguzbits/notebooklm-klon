# Spike-Ergebnisse

Ergebnisse des Modell-Spikes (Plan: [PLAN.md](PLAN.md#spike-plan)). Der Spike-Code liegt in [spikes/](../spikes/) und ist Wegwerf-Code. Die Rohausgaben stehen unter `spikes/results/` (nicht im Repo, sie enthalten Fremdtext). Kein Vergleich mit OpenAI-Modellen, weil kein Zugang vorhanden ist.

Testmenge: 7 öffentliche Dokumente ([spikes/corpus/README.md](../spikes/corpus/README.md)), 18 Golden-Fragen ([golden-questions.json](../apps/api/src/eval/golden-questions.json)).

## 1. Parsing (PDF)

Vier PDFs mit zusammen 28 Seiten: zweispaltiges Paper (01), Destatis-Tabellen (02), Grundgesetz-Auszug (04), Scan (05). Jeder Kandidat lief einmal, Temperatur 0. Die Werte sind Einzelmessungen, Wiederholbarkeit ist nicht geprüft.

| Messgröße                                   | liteparse (lokal, OCR)  | `gemini-3.1-flash-lite`        | `gemini-3.5-flash-lite`     |
| ------------------------------------------- | ----------------------- | ------------------------------ | --------------------------- |
| Anker der Golden-Fragen wörtlich gefunden   | 10 von 11               | 11 von 11                      | 6 von 11                    |
| Wort-Recall Paper (01)                      | 96,8 %                  | 98,1 %                         | 98,2 %                      |
| Wort-Recall Destatis (02)                   | 97,8 %                  | 91,8 %                         | 99,3 %                      |
| Wort-Recall Grundgesetz (04)                | 98,6 %                  | 82,9 % (Referenzartefakt)      | 82,9 % (Referenzartefakt)   |
| Wort-Recall Scan (05)                       | 92,6 %                  | 99,9 %                         | 0 % (Antwort blockiert)     |
| Tabellen als Markdown-Tabelle erhalten (02) | nein (0 Tabellenzeilen) | ja                             | ja, aber Kopf verfälscht    |
| Zeit für alle vier PDFs                     | ca. 6 s                 | ca. 109 s                      | ca. 95 s                    |
| Kosten (Paid-Preise, 28 Seiten)             | 0                       | ca. 0,05 $ (ca. 0,002 $/Seite) | ca. 0,09 $ (Scan blockiert) |

Wie gemessen: Der Wort-Recall zählt, wie viele Wörter des Referenztexts (Text der Originalseiten, ohne OCR) im geparsten Text vorkommen. Beim Grundgesetz liegt der Wert bei beiden Modellen nur wegen der gesperrt gesetzten Überschriften der Referenz (`G r u n d g e s e t z`, 595 von 596 fehlenden Wörtern sind Einzelbuchstaben) unter 100 %.

Befunde:

- **`gemini-3.1-flash-lite`** liest den Scan fast vollständig (99,9 %), erhält Tabellen und die Lesereihenfolge des zweispaltigen Papers. Schwäche: Auf der Diagramm-Seite von Destatis fehlen Bildunterschriften und Fußnoten (`Ergebnisse des Mikrozensus`, Jahreszahlen), etwa 8 % der Wörter.
- **`gemini-3.5-flash-lite`** ist bei Destatis vollständiger (99,3 %), verfälscht aber die Tabellenüberschrift (`Bevölkerungsvertrag` statt `Bevölkerung`), klebt Seitentext in Tabellenzellen und setzt Fettdruck (`**Erwerbspersonen**`), der wörtliche Anker bricht. Der Scan lieferte 0 Zeichen mit `finishReason: RECITATION` (Antwort wegen Zitierschutz unterdrückt). Das ist ein Ausfall, kein Qualitätsunterschied.
- **liteparse** ist bei Text-PDFs gleichauf und praktisch kostenlos, liefert aber keine Tabellenstruktur. Beim Scan liest die OCR durchgehend `Al` statt `AI` und vertauscht bei leichter Schräglage Zeilen (`the Organisation for Economic Co-operation and Development / Al actors are defined by including…`).

**Entscheidung Parsing:** `gemini-3.1-flash-lite` für PDFs (höchste Inhaltstreue über alle vier Dokumente, kein Ausfall). liteparse bleibt Fallback und lokale Vollständigkeitsprüfung: Bei PDFs mit Textebene lässt sich der Wort-Recall der Gemini-Ausgabe gegen den liteparse-Text prüfen und bei Lücken warnen. Das wäre ein eigener, später zu bauender Schritt, nicht Teil des Spikes.

Grenzen: Anker prüfen nur Auslassungen an 11 Stellen. Lesereihenfolge und Tabellen wurden nur an den genannten Stichproben beurteilt, nicht Zelle für Zelle. `RECITATION` bei `gemini-3.5-flash-lite` ist eine Einzelbeobachtung und kann mit anderem Prompt anders ausfallen.

## 2. Embeddings

120 Chunks (ca. 1500 Zeichen, 200 Zeichen Überlappung) aus allen 7 Dokumenten in einem gemeinsamen Suchraum. Die PDFs kommen aus der Parsing-Ausgabe von `gemini-3.1-flash-lite`, die übrigen Dokumente aus dem Referenztext. 768 Dimensionen, Kosinus-Ähnlichkeit über normalisierte Vektoren. Ein Treffer heißt: Ein Chunk mit einem Anker der Golden-Frage liegt in den Top 5. Jedes Modell lief einmal.

| Messgröße                             | `gemini-embedding-2` (Aufgabe im Text) | `gemini-embedding-001` (`taskType`) |
| ------------------------------------- | -------------------------------------- | ----------------------------------- |
| Top-5-Treffer gesamt (18 Fragen)      | 17                                     | 16                                  |
| deutsche Frage, deutsche Quelle (10)  | 9                                      | 10                                  |
| deutsche Frage, englische Quelle (3)  | 3                                      | 2                                   |
| englische Frage, englische Quelle (5) | 5                                      | 4                                   |
| Rang 1 / Top 3                        | 11 / 17                                | 13 / 15                             |
| mittlerer reziproker Rang (MRR)       | 0,76                                   | 0,81                                |
| maximale Eingabe                      | 8.192 Token                            | 2.048 Token                         |

Fehlgriffe: Embedding 2 verfehlt `destatis-erwerbspersonen` (Rang 6, knapp außerhalb). Embedding 001 verfehlt `dpr-top5` und `dpr-top5-de` (Rang 8), beide auf denselben englischen Chunk.

**Entscheidung Embeddings:** `gemini-embedding-2`. Der Unterschied ist eine Frage von 18 und damit Rauschen, es gilt die Regel des Plans (Gleichstand: Embedding 2). Es hat außerdem die größere Eingabe. Nachteile: Die Aufgabe steht im Text statt in einem Feld, und die Dokumentation nennt es an einer Stelle `gemini-embedding-2-preview` (Preview) und an anderer `gemini-embedding-2`. Beide IDs stehen in der Modellliste der API, gewählt ist `gemini-embedding-2`. Ein späterer Wechsel des Modells verlangt, alle Vektoren neu zu berechnen.

Grenzen: Nur 18 Fragen und ein Chunking (1500 Zeichen), keine Wiederholung. Das Chunking ist keine Entscheidung dieses Spikes. Die Drosselung nach geschätzten Tokens (30K pro Minute) hat gehalten, es gab keinen HTTP-Fehler. 120 Chunks brauchten wenige Minuten.

## 3. Chat und Zitate

Ablauf pro Frage: Top 5 Chunks aus Teil 2 (`gemini-embedding-2`), nummeriert als `c1` bis `c5`, dazu die Frage. Das Modell antwortet gestreamt in strukturierter Ausgabe: `{ statements: [{ text, chunkIds[] }] }`, Temperatur 0, Antwort in der Sprache der Frage. Die Antworten sind einzeln gespeichert und lassen sich offline neu bewerten (`spikes/score-chat.mjs`). Alle 18 Fragen mit `gemini-3.5-flash-lite`, fünf ausgewählte zusätzlich mit `gemini-3.5-flash`.

| Messgröße                                          | `gemini-3.5-flash-lite` (18) | `gemini-3.5-flash` (5, Stichprobe) |
| -------------------------------------------------- | ---------------------------- | ---------------------------------- |
| Zitat-Gültigkeit (Zitate mit ID aus dem Kontext)   | 100 %                        | 100 %                              |
| Zitat-Abdeckung (Aussagen mit gültigem Zitat)      | 100 %                        | 100 %                              |
| Pflichtfakten in der Antwort                       | 96 %                         | 89 %                               |
| Pflichtfakten im zitierten Chunk (trägt das Zitat) | 92 %                         | 78 %                               |
| Zeit bis zum ersten Token, Median                  | 0,9 s                        | 14,6 s                             |
| Zeit bis zum ersten Token, Maximum                 | 16,9 s                       | 19,1 s                             |
| Kosten pro Antwort (Paid-Preise)                   | ca. 0,0009 $                 | nicht erhoben                      |

Befunde:

- **Zitat-Format trägt.** Kurze IDs pro Anfrage (`c1` bis `c5`), die der Server auf echte Chunk-IDs abbildet, wurden nie erfunden oder falsch zitiert. Das Modell erfindet so keine UUIDs, und der Server kann jede ID gegen den gesendeten Kontext prüfen.
- **Gültige Zitate sind kein Beleg für richtige Antworten.** Bei `destatis-erwerbspersonen` fand die Suche den Treffer erst auf Rang 6. Beide Modelle antworteten mit einer falschen Zahl (`43 360 Tsd.` statt 46,2 Mio.) und zitierten gültige Chunks. Die Zitat-Gültigkeit bleibt dabei bei 100 %. Die Zeile "im zitierten Chunk" zeigt das, ist aber nur bei gleicher Sprache von Frage und Quelle aussagekräftig (bei `rag-benefits-limits` steht `Halluzination` nur in der deutschen Antwort, nicht im englischen Chunk).
- **Ein größeres Modell hilft nicht.** `gemini-3.5-flash` macht denselben Fehler, denkt dabei aber 200 bis 1400 Token lang und braucht 12 bis 19 s bis zum ersten Token. Der Hebel liegt in der Suche (Hybrid-Retrieval, Schlüsselwörter wie `Erwerbspersonen 2018`), nicht im Modell.
- **Latenz mit Ausreißern.** Der Median von `gemini-3.5-flash-lite` liegt bei 0,9 s, drei von 18 Antworten brauchten aber 6 bis 17 s (ohne Denk-Token, also Wartezeit auf Google-Seite im Free Tier). Das Ziel von etwa 5 Sekunden wurde damit in 15 von 18 Fällen erreicht.
- Ein Lauf der Stichprobe brach einmalig mit einem HTTP-Fehler ab (Meldung nicht festgehalten) und lief beim zweiten Versuch durch. Beim Free Tier (5 Anfragen pro Minute bei `gemini-3.5-flash`) kann das Limit die Ursache sein.

**Entscheidung Chat:** `gemini-3.5-flash-lite` mit strukturierter Ausgabe (Aussagen mit kurzen Chunk-IDs), Server-Prüfung der IDs gegen den gesendeten Kontext. Das große Flash-Modell bleibt Reserve für Studio, wo Wartezeit weniger stört. Der Prompt soll zusätzlich verlangen, bei nicht eindeutig belegter Antwort das offen zu sagen. Ob das die falsche Zahl verhindert, ist nicht getestet.

Grenzen: 18 Fragen, ein Lauf, alle beantwortbar (kein Test auf Verweigerung bei fehlender Antwort). Zeit bis zum ersten Token im Free Tier ist eine Momentaufnahme. Kosten sind aus den Token-Zahlen der Antworten und den Paid-Preisen berechnet, nicht gemessen.

## 4. Hybrid-Suche (Nachtrag)

Nach dem Spike gebaut ([retrieval.ts](../apps/api/src/db/retrieval.ts)): Vektorsuche plus Volltextsuche, Fusion per RRF in SQL, Zugriffsfilter nach Nutzer, Notizbuch und gewählten Quellen. Stoppwörter der Frage filtert PostgreSQL selbst (`ts_lexize`, Deutsch und Englisch). Getestet mit denselben 120 Chunks und Embeddings wie Teil 2, ohne neue Modellaufrufe:

| Variante                                    | Top-5-Treffer (18 Fragen) | Verfehlt                        |
| ------------------------------------------- | ------------------------- | ------------------------------- |
| nur Vektorsuche (Teil 2)                    | 17                        | `destatis-erwerbspersonen`      |
| Hybrid, OR-Suche ohne Stoppwortfilter       | 16                        | zwei Fragen verdrängt           |
| Hybrid mit Stoppwortfilter, Textgewicht 1,0 | 16                        | `dpr-top5`, `dpr-top5-de`       |
| Hybrid mit Stoppwortfilter, Textgewicht 0,5 | 16 bis 17                 | `dpr-top5-de` (je nach Rundung) |

Befund: Hybrid behebt den Zahlen-Fall (`Erwerbspersonen`, jetzt Rang 2), ist aber auf diesen 18 Fragen nicht besser als die Vektorsuche. Eine deutsche Frage findet in englischem Text keine Wörter, die Textseite liefert dort nur Rauschen. Der Unterschied zwischen 16 und 17 kippt mit der Rundung (`float8` gegen `numeric`) und ist damit nicht belastbar. Das Textgewicht 0,5 steht im Code, begründet nur durch den Sprachunterschied, nicht durch Messung. Mit mehr Fragen (vor allem deutsch auf englisch und Zahlen) neu prüfen.

Verifizierte Modell-IDs und Limits (Google-Dokumentation und Modellliste der API, Free-Tier-Limits laut Dashboard):

| Modell                                    | Free Tier (RPM / TPM / RPD) | Preis pro 1 Mio. Tokens (Paid, Eingabe / Ausgabe) |
| ----------------------------------------- | --------------------------- | ------------------------------------------------- |
| `gemini-3.1-flash-lite`                   | 15 / 250K / 500             | 0,25 $ / 1,50 $                                   |
| `gemini-3.5-flash-lite`                   | 15 / 250K / 500             | 0,30 $ / 2,50 $                                   |
| `gemini-3.5-flash` bis `gemini-3.8-flash` | 5 / 250K / 20               | nicht erhoben                                     |
| `gemini-embedding-2`                      | 100 / 30K / 1000            | 0,20 $ (Text)                                     |
| `gemini-embedding-001`                    | nicht erhoben               | nicht erhoben                                     |
