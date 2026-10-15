# Plan 4: Doppelte Werte und Temperatur

Stand: 2026-10-15. Doppelte Werte gebaut, Temperatur geschlossen.

## Doppelte Werte (gebaut)

Ursache war der Satz im Chat-Prompt „give both forms in one statement and cite both passages“ (Commit `da65b56`). Er ließ das Modell `46 185 Tausend bzw. 46,2 Millionen` und
`617 000 bzw. rund 620 000` schreiben und widersprach „Say each fact once“. Jetzt steht ein Wert einmal in der genauen Form mit allen stützenden Zitaten; eine zweite Form nur, wenn die Quellen
widersprechen ([chat-prompt.ts](../../apps/api/src/core/chat-prompt.ts)).

Eval: `forbiddenFacts` auf der gerundeten Form in `destatis-erwerbspersonen` und `destatis-landwirtschaft`, Pflichtfakt ist die genaue Form. Die Baseline-Antworten waren dagegen rot (aus den
Antworten abgeleitet, nicht neu bewertet), nach der Änderung grün (n=1); ein voller Lauf zeigte keine Regression. Bei „Wie viele Erwerbspersonen“ steht seitdem der Mikrozensus-Wert vor dem der
Erwerbstätigenrechnung (beide stehen in den Quellen).

## Temperatur (nicht gemessen, geschlossen)

Alle Aufrufe nutzen 0 (`ai/gemini-chat.ts`, `ai/gemini-pdf-parser.ts`); `thinkingLevel` ist nicht gesetzt. Gemini 3 empfiehlt laut Doku 1,0 (vor einer Änderung neu lesen, Regel 12). Ein Vergleich je Rolle
mit n >= 3 kostet grob 1 bis 2 Euro und ist auf der gesättigten Eval-Menge ([Plan 3](03-eval.md)) nicht aussagekräftig. Wieder aufmachen, wenn schwerere Fragen eine Schwäche zeigen. Soll es kommen:
`GENERATION = { CHAT, QUERY, PDF, STUDIO }` mit `temperature` und `thinkingLevel` in `apps/api/src/config`, je Rolle ein Test, dass der Anfragekörper den Wert aus der Konfiguration trägt.
