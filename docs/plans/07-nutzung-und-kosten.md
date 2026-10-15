# Plan 7: Nutzung, Limits und Kosten

Stand: 2026-10-15

## Stand der Umsetzung

Schritt 1 bis 6 sind gebaut. Jeder Modellaufruf schreibt eine Zeile in `usage_events` (Nutzer, Zweck, Rolle, Eingabe- und Ausgabe-Tokens, Kennzeichen „geschätzt“; Thinking-Tokens zählen als
Ausgabe; Aufrufe älter als 30 Tage werden stündlich gelöscht). `pnpm report:usage` fasst sie je Zweck und je Nutzer zusammen. `MAX_OUTPUT_TOKENS` in `config/limits.ts` deckelt jede Antwort; die Werte sind
**vorläufig und großzügig**, bis der Bericht zeigt, was jeder Zweck braucht. Nicht gezählt wird die Websuche (kein Modellaufruf, keine Tokens). Der Bericht nennt Tokens je **Aufruf**, nicht je
Aktion: Eine Chat-Frage besteht aus bis zu vier Aufrufen (Umformulieren, Übersetzen, Einbetten, Antwort). Die Tabelle „Kosten je Aktion“ mit Preisen (gegen die Preisseite prüfen) entsteht, sobald es echte
Messdaten gibt.

Schritt 4 bis 6 sind gebaut (die Höhen stehen in `config/limits.ts` und sind **Annahmen**, bis es echte Messdaten gibt):

- **Grenze je Nutzer** in einem gleitenden Fenster von 24 Stunden, gezählt aus `usage_events`: 40 Fragen im Chat (`CHAT_QUESTIONS_PER_WINDOW`), 10 Studio-Ausgaben (`STUDIO_OUTPUTS_PER_WINDOW`). Eine Frage
  ist ein Ereignis mit Zweck `CHAT`; Umformulieren, Übersetzen und Einbetten der Frage laufen unter `QUESTION_PREPARATION` und zählen nicht mit. Chat leeren setzt die Grenze nicht zurück.
- **Notbremse** für alle: 2 Millionen Tokens am Tag (`DAILY_TOKEN_BUDGET`). Ist sie erreicht, sind Chat, Studio, neue Übersichten und das Lesen von Quellen gesperrt („Heute ist das Kontingent der Demo
  aufgebraucht“); eine schon gespeicherte Übersicht wird weiter gezeigt. Die Höhe folgt aus einem Restguthaben von etwa 4 € (Stand 2026-10-15) und den Preisen von gemini-3.5-flash-lite (0,30 USD je Million Eingabe-Tokens, 2,50 USD je Million Ausgabe-Tokens inklusive Thinking; Quelle: ai.google.dev/gemini-api/docs/pricing, Stand 2026-10-14, per Agent abgerufen und noch nicht von Hand geprüft). Eine Frage kostet gemessen etwa 0,35 Cent (5 beantwortete Fragen des Live-Evals am 2026-10-15: im Mittel 6 600 Tokens Eingabe, 590 Ausgabe inklusive Thinking, dazu die Vorbereitung mit rund 100 Tokens); eine Studio-Ausgabe mit 2 Cent ist weiter nur geschätzt.
- **Ein laufender Aufruf je Nutzer** für Chat und Studio (HTTP 409 `REQUEST_IN_PROGRESS`). Der Merker liegt im Speicher des Prozesses und stimmt nur, solange ein Container läuft.
- `GET /api/usage` liefert `{chat, studio, budgetReached}`; die Oberfläche zeigt ab 75 % (`USAGE_WARNING_RATIO`) „Noch N Fragen heute.“, sperrt am Limit das Eingabefeld und die Studio-Kacheln und
  nennt die Uhrzeit, ab der es wieder geht.
- Offen: die Messung selbst (`pnpm eval:live`, echte Nutzung), danach die Höhen und `MAX_OUTPUT_TOKENS` eichen. Unbelegt ist, ob `maxOutputTokens` die Thinking-Tokens mitzählt; vor dem Verkleinern prüfen.

## Entscheidungen (2026-10-14, vom Nutzer)

- Das Limit kommt wieder; alle Nutzer gleich, Gäste wie Konten. Verbrauch liegt in der Datenbank (`usage_events`, 30 Tage).
- Form wie bei NotebookLM, einfach: gezählt werden Fragen und Studio-Ausgaben je Nutzer in 24 Stunden (gleitend), eine Zahl je Funktion. Tokens werden je Aufruf gemessen, aber nur zum Eichen und als Notbremse.
- Keine ständige Anzeige: Hinweis erst ab 75 %, am Limit ist das Eingabefeld gesperrt und nennt die Freigabezeit. Oberfläche sagt „Fragen“ und „Ausgaben“, nie „Token“ (Regel 10).
- Notbremse für alle (Tokens je Tag), ehrliche Meldung statt Fehlern. Keine bestätigte E-Mail zunächst; neu bewerten, wenn die Messung Missbrauch zeigt.
- Ein laufender Aufruf je Nutzer. Übersicht und Quellenlesen zählen nicht gegen den Nutzer, nur gegen die Notbremse und die bestehenden Grenzen.
- Der frühere Stand (Commit `ac6e991`) ist im Verlauf nachlesbar.

## Offen

- Messung mit echter Nutzung, danach Höhen und `MAX_OUTPUT_TOKENS` eichen. Ob `maxOutputTokens` Thinking-Tokens mitzählt, ist unbelegt.

## Schlüssel und Free Tier für die Evals (2026-10-15)

- Die Live-Evals (`pnpm eval:live`, `eval:studio`, `eval:overview`) lesen `EVAL_GEMINI_API_KEY` (`parseEvalEnv`), nie `GEMINI_API_KEY`; es gibt keinen Rückfall. So verbraucht ein Eval nie das bezahlte Guthaben des Betriebsschlüssels. Der Schlüssel kann aus einem Konto mit Free Tier stammen.
- Free-Tier-Werte aus der AI-Studio-Konsole, Stand 2026-09-29 (aus der Git-Historie, Commits `64b48c7`, `e3bafc6`): Flash 5 Anfragen/Min und 20 pro Tag, Flash-Lite 15 Anfragen/Min und 500 pro Tag, je 250K Tokens/Min. Nur ein Verlauf: Die offizielle Seite zu Rate Limits (ai.google.dev/gemini-api/docs/rate-limits, geprüft 2026-10-15) nennt keine Free-Tier-Zahlen und verweist auf die AI-Studio-Konsole (aistudio.google.com/rate-limit). Werte für `gemini-embedding-2` fehlen. Vor einem Lauf dort nachsehen (Regel 12).
- Im Free Tier sind Anfragen und Eingaben für Google nutzbar (Training); die Evals senden nur öffentliche Texte.

Höhen seit 2026-10-15: 40 Fragen, 10 Studio-Ausgaben, 2 Mio. Tokens am Tag. Grund: Die Seite ist eine Demo für Bewerbungen mit sehr wenigen Besuchern; ein Besucher, der alles ausprobiert, soll nicht an ein Limit stoßen, und zwei Besucher am selben Tag sollen ins Budget passen. Das Tagesbudget bleibt die eigentliche Sicherung des Guthabens (schlimmster Fall etwa 1,2 USD am Tag, geschätzt).

Erster Live-Eval (2026-10-15, Free-Tier-Schlüssel): 29 von 34 Fragen schlugen fehl, weil das Tageskontingent des Free Tiers nach etwa 9 Fragen erschöpft war (`CHAT_LIMIT_REACHED`/`GeminiError`) und vier Übersetzungsaufrufe vorher je 120 s in ein Timeout liefen. Die Trefferquoten dieses Laufs sind daher **keine Qualitätsmessung**. Nutzbar sind nur die Token-Zahlen der 5 beantworteten Fragen (`pnpm report:usage`: je Frage 6 623 Tokens Eingabe, 587 Ausgabe). Ein ganzer Lauf braucht für 34 Fragen mindestens 68 Modellaufrufe und passt nicht in ein Free-Tier-Tageskontingent.
