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

Verifizierte Modell-IDs und Limits (Google-Dokumentation und Modellliste der API, Free-Tier-Limits laut Dashboard):

| Modell                                    | Free Tier (RPM / TPM / RPD) | Preis pro 1 Mio. Tokens (Paid, Eingabe / Ausgabe) |
| ----------------------------------------- | --------------------------- | ------------------------------------------------- |
| `gemini-3.1-flash-lite`                   | 15 / 250K / 500             | 0,25 $ / 1,50 $                                   |
| `gemini-3.5-flash-lite`                   | 15 / 250K / 500             | 0,30 $ / 2,50 $                                   |
| `gemini-3.5-flash` bis `gemini-3.8-flash` | 5 / 250K / 20               | nicht erhoben                                     |
| `gemini-embedding-2`                      | 100 / 30K / 1000            | 0,20 $ (Text)                                     |
| `gemini-embedding-001`                    | nicht erhoben               | nicht erhoben                                     |
