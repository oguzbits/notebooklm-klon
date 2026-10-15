# Plan 3: Eval

Stand: 2026-10-15. Teilweise gebaut.

## Gebaut

- 34 goldene Fragen mit Textankern und deterministischen Bewertern ([golden-questions.json](../../apps/api/src/eval/golden-questions.json), [scorers.ts](../../apps/api/src/eval/scorers.ts)), Bericht, `pnpm eval:live`, `eval:studio`, `eval:overview`. Nur live, Korpus unter `spikes/corpus` (nicht im Repo).
- Baseline vom 2026-10-15 (bezahlter Schlüssel, ein Lauf, etwa 12 Cent): Suchtreffer 100 %, Fakten in Antwort 100 %, Fakten im Zitat 100 %, richtig verweigert 100 %, keine verworfenen Aussagen. Die eine Lücke (96 %) war ein Bewerterfehler: `**fett**` wurde mitgelesen, behoben in `normalizeText`.
- Gate: [baseline.json](../../apps/api/src/eval/baseline.json) und [gate.ts](../../apps/api/src/eval/gate.ts). Ein voller Lauf endet mit Fehlercode 1, wenn ein Maß mehr als `GATE_TOLERANCE` (5 Prozentpunkte, etwa eine Frage, geschätzt) unter die Baseline fällt.
- Free Tier: Ein 429 wird nach 65 s einmal wiederholt, bleibt das Kontingent leer, bricht der Lauf ab und nennt die Rest-IDs für `--ids` (`run-all.ts`). Der Lauf mit Free-Tier-Schlüssel schaffte am 2026-10-15 nur 4 Fragen und ist keine Messung.

## Gemessen

Die Menge ist **gesättigt**: Bei 100 % ist eine Verbesserung nicht mehr messbar, nur eine Verschlechterung. Für Experimente (Plan 5) und die Temperatur (Plan 4) braucht es zuerst schwerere Fragen (Quellen vergleichen, Zahlen aus Tabellen, deutsche Fragen zu englischen Quellen).

## Offen

- n >= 3 je Frage und die Schwelle aus der Schwankung statt geschätzt.
- Korpus im Repo (Lizenz klären), Replay offline (Invariante 5).
- Schwerere Fragen, sonst bleibt die Menge ohne Aussagekraft für Verbesserungen.
