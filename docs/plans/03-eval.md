# Plan 3: Eval

## Stand (2026-10-15)

Baseline gemessen mit dem bezahlten Schlüssel, 34 Fragen, ein Lauf (n=1), Kosten etwa 12 Cent: Suchtreffer 100 %, Fakten in der Antwort 96 % (die eine Lücke war ein Fehler des Bewerters: er las `**verhindert Halluzinationen** nicht` nicht, behoben in `normalizeText`, danach 100 %), Fakten im Zitat 100 %, richtig verweigert 100 %, keine verworfenen Aussagen. Die Baseline steht in [baseline.json](../../apps/api/src/eval/baseline.json); `pnpm eval:live` vergleicht einen vollen Lauf damit und endet mit Fehlercode 1, wenn ein Maß um mehr als 5 Prozentpunkte fällt (`GATE_TOLERANCE`, geschätzt: ungefähr eine Frage Spielraum, nicht aus Wiederholungen gemessen). Offen: n >= 3, Schwelle aus der Schwankung, Korpus im Repo, Replay. **Die Menge ist gesättigt:** Bei 100 % gibt es nichts mehr zu verbessern; Änderungen an Suche oder Prompt sind damit nur noch als Verschlechterung erkennbar. Für Verbesserungen braucht es schwerere Fragen.

## Ist (vor dem Stand oben)

- 34 goldene Fragen mit Textankern und deterministischen Bewertern, nur live (`pnpm eval:live`).
- Korpus ist nicht im Repo, kein Replay, keine Baseline, kein Gate, ein Durchlauf je Frage (n=1).

## Vorbilder (vor der Umsetzung neu lesen)

- Hamel Husain und Shreya Shankar: Fehleranalyse an echten Verläufen zuerst, dann Bewerter.
- Anthropic, „Demystifying evals“ (Januar 2026): Aufgaben mit eindeutigem Erfolgskriterium, mehrere Durchläufe, Bewerter prüfen.
- Klassische IR-Maße (Recall@k, MRR) für die Suche; RAGAS-Begriffe (Treue, Kontexttreffer) als Vokabular; FACTS Grounding als Vorbild für Belegtreue.

## Ziel

Eine Änderung an Prompt, Chunking oder Suche ist vor dem Merge als besser, gleich oder schlechter belegt.

## Bausteine

1. **Korpus im Repo**: öffentliche oder selbst geschriebene Texte, Lizenz geklärt, klein genug zum Einchecken. Entscheidung offen.
2. **Zwei Stufen**:
   - Suche (offline, schnell): je Frage die erwarteten Textanker in den Top-k? Maße Recall@k und MRR. Läuft in `pnpm test` mit festen Einbettungen aus Aufnahmen.
   - Antwort (live, selten): Treue (jede Aussage durch zitierte Passage gedeckt), Zitatgültigkeit (nur Chunks aus dem Kontext), Vollständigkeit gegen Anker.
3. **Replay**: Modellantworten einmal aufnehmen, offline wiederholen (Invariante 5). Aufnahme trägt Modell-ID, Prompt-Hash, Datum.
4. **n >= 3** je Frage bei Live-Läufen, Ausgabe als Anteil bestanden, nicht als einzelnes Ja/Nein.
5. **Baseline und Gate**: `eval/baseline.json` im Repo; Lauf schlägt fehl, wenn ein Maß um mehr als die gemessene Schwankung fällt. Schwelle aus den ersten Läufen, nicht geraten.
6. **Fehleranalyse zuerst**: 30 echte oder erdachte Verläufe lesen, Fehlerarten notieren, daraus neue goldene Fragen (u. a. der Fall „46,2 Mio.“).
7. **Bewerter prüfen**: Wenn ein LLM-Bewerter dazukommt, an handbewerteten Fällen gegen Übereinstimmung messen.

## Interfaces

- Schema `EvalCase` und `EvalResult` in `packages/shared` (Frage, Quellen, erwartete Anker, erlaubte Zitate).
- Bewerter sind reine Funktionen in `apps/api/src/core` (Eingabe: Antwort und Kontext, Ausgabe: Urteil mit Grund).

## Testfälle (für die Bewerter)

- Antwort zitiert Chunk außerhalb des Kontexts: Urteil „ungültig“.
- Aussage ohne Zitat: „unbelegt“.
- Anker fehlt in Top-k: Recall sinkt; MRR ändert sich bei Rangwechsel.
- Gate: Baseline minus Schwelle ergibt Fehler, innerhalb der Schwelle nicht.

## Welcher Test wird rot

- Prüfung „Zitat im Kontext“ entfernen: Test „außerhalb des Kontexts“. Gate-Vergleich umdrehen: Gate-Test.

## Offen

- Welche Texte kommen in den Korpus (Lizenz)? Wer bewertet die ersten 30 Verläufe?
