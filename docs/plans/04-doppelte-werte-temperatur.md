# Plan 4: Doppelte Werte und Temperatur

## Doppelte Werte

- Ist: `core/chat-prompt.ts` verlangt bewusst „beide Formen in einer Aussage nennen und beide Passagen zitieren“.
  Folge: Ein Wert wie „46,2 Mio.“ erscheint in zwei Schreibweisen oder doppelt, die Antwort wirkt unsicher.
- Ziel: eine zuversichtliche Antwort, ohne die Belegpflicht aufzugeben.
- Regel (Vorschlag): Ein Wert wird einmal genannt, in der Form der am besten belegenden Passage, mit allen Zitaten, die ihn stützen.
  Eine zweite Form steht nur, wenn die Quellen sich widersprechen; dann wird der Widerspruch benannt statt beide Formen gleichrangig zu nennen.
- Bewertung nur mit Eval ([Plan 3](03-eval.md)): neue goldene Fälle „gleicher Wert in zwei Schreibweisen“ und „Quellen widersprechen sich“.
  Der Prompt wird erst geändert, wenn beide Fälle vorher rot sind.
- Test auf Vertragsebene (nicht Wortlaut): Prompt enthält weiterhin Zitatschema und Abwehr von Anweisungen im Quelltext.

## Temperatur

- Ist: überall 0 (`ai/gemini-chat.ts`, `ai/gemini-pdf-parser.ts`). Die erinnerten 0,5 sind `TEXT_WEIGHT` der Suche, keine Temperatur.
- Gemini 3 empfiehlt laut Doku Standardwert 1,0; kleinere Werte können zu Schleifen oder schlechterer Leistung führen. Vor der Entscheidung die Doku neu lesen.
- `thinkingLevel` ist nicht gesetzt (Flash-Lite: minimal). Mitprüfen, denn es wirkt auf Genauigkeit stärker als die Temperatur.
- Vergleich: notar-agent nutzt 0,1 und 0,0 (anderes Modell, andere Aufgabe, nur als Hinweis).
- Vorschlag je Rolle, alles aus der Konfiguration (Invariante 4): Chat-Antwort, Anfrage-Übersetzung, PDF-Auslesen, Studio-Ausgaben je ein eigener Wert in `apps/api/src/config`.
- Entscheidung per Messung: je Rolle 0 gegen 1,0 (und ein Zwischenwert), n >= 3, Maße aus dem Eval. Gewinner nur, wenn er nicht schlechter ist als die Schwankung.

## Schnittstellen

- `config/limits.ts` oder neue `config/generation.ts`: `GENERATION = { CHAT: {...}, QUERY: {...}, PDF: {...}, STUDIO: {...} } as const` mit `temperature` und `thinkingLevel`.

## Testfälle

- Jede Rolle liest ihren Wert aus der Konfiguration (Anfragekörper enthält den Wert).
- Kein Aufruf setzt eine Temperatur außerhalb der Konfiguration.

## Welcher Test wird rot

- Wert im Chat-Aufruf fest einbauen: Test „Anfragekörper enthält konfigurierten Wert“.
