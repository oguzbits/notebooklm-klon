# Plan 7: Nutzung, Limits und Kosten

## Stand der Umsetzung (2026-10-14)

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

## Ist (im Code belegt, Stand 2026-10-14, vor Schritt 1 bis 3)

- Der Rate-Limiter (`apps/api/src/ai/rate-limiter.ts`) hält die Aufrufe unter den Limits des Anbieters (`PROVIDER_LIMITS` in `config/limits.ts`, Werte des
  bezahlten Tarifs von 2026-10-03). Er liegt im Speicher, arbeitet in einer gemeinsamen Warteschlange und kennt keine Nutzer.
- **Kein Limit pro Nutzer** für Chat, Studio, Quellen, Notizbücher oder Websuche. Es gab eines (Commit `ac6e991`, 2026-10-02: Chat und Studio je Nutzer und Stunde, neue Quellen);
  der Nutzer hat es am 2026-10-03 entfernt (`e1051e2`, `433be81`). Offen ist, ob diese Entscheidung unter den Antworten unten Bestand hat.
- Vorhandene Schutzgrenzen: Upload 10 MB, PDF 50 Seiten, URL-Import 5 MB, Frage 2000 Zeichen, 12 Passagen und 3 Verlaufsrunden je Chat-Anfrage,
  Studio 120 000 Zeichen je Ausgabe, Inhalts-Hash je Nutzer, Gäste 20 je Stunde (alle zusammen), 200 gleichzeitig, 7 Tage.
- Gemessen wurde nur eine Zahl (jetzt ersetzt durch `usage_events`): Der Chat loggte `promptTokens` und `outputTokens` je Antwort (`providers.ts`), ohne Nutzer und ohne Zweck.
  Studio, Übersicht, Lesen von Quellen und Embedding verbrauchen Tokens, die niemand zählt; der Limiter rechnet dort mit Schätzungen.
- Es ist keine Obergrenze für die Länge einer Modellantwort gesetzt (kein `maxOutputTokens`).
- Gäste sind echte Konten und kosten dasselbe wie Nutzer. Der Limiter reiht alle Anfragen nacheinander ein: Ein Nutzer mit vielen Anfragen verzögert alle anderen.
- Teuer sind: Studio-Ausgabe (bis rund 30 000 Tokens Eingabe), YouTube (der Limiter reserviert 90 000 Tokens je Video), Audio, die Notizbuch-Übersicht
  (neu bei jeder Änderung der Quellenauswahl), erneutes Lesen einer fehlgeschlagenen Quelle.

## Ziel

Der Verbrauch jedes Nutzers ist sichtbar, und kein einzelner Nutzer kann Budget oder gemeinsames Kontingent aufbrauchen, ohne dass es auffällt oder gebremst wird.
Reihenfolge: erst messen, dann entscheiden, dann begrenzen.

## Entscheidungen (2026-10-14)

Vom Nutzer: Das Limit kommt wieder. Alle Nutzer werden gleich behandelt, Gäste wie Konten. Jeder darf sich anmelden. Keine Sonderbegrenzung für teure Wege. Der Verbrauch liegt in der Datenbank.
Das Guthaben bei Google ist fest. Die Höhe der Grenzen folgt aus der Messung (Schritt 2): Sie soll zwischen „normal“ und „exzessiv“ liegen.
**Form der Grenze: wie bei NotebookLM, einfach.** Der Nutzer hat zuerst Tokens und einen Ring genannt und danach gesagt, die Lösung von NotebookLM sei einfacher und eleganter. Daraus folgt (Stand: so
umzusetzen, solange der Nutzer nicht widerspricht):

- **Gezählt wird, was der Nutzer versteht:** Fragen im Chat und erzeugte Studio-Ausgaben, je Nutzer in den letzten 24 Stunden (gleitend). Tokens werden trotzdem je Aufruf gemessen, aber nur zum
  Eichen der Zahlen und als Notbremse, nicht als Anzeige. Das trägt, weil jede Eingabe schon begrenzt ist (Frage 2000 Zeichen, 12 Passagen, 3 Verlaufsrunden, Studio 120 000 Zeichen) und mit
  `maxOutputTokens` (Schritt 3) auch jede Ausgabe: Eine Frage kostet dann höchstens ein bekanntes Vielfaches der durchschnittlichen.
- **Keine ständige Anzeige.** Der Ring entfällt als Dauerelement. Erst wenn wenig übrig ist (Vorschlag: ab 75 % verbraucht), erscheint unter dem Eingabefeld ein ruhiger Hinweis in der Warnfarbe
  („Noch 10 Fragen heute“). Am Limit ist das Eingabefeld gesperrt und nennt den Zeitpunkt („Das Limit ist erreicht. Ab 15:00 Uhr geht es wieder.“), wie NotebookLM es laut Drittquellen tut.
- **Eine Zahl je Funktion**, nicht ein Topf: Chat, Studio-Ausgabe. Die Notizbuch-Übersicht und das Lesen von Quellen zählen nicht gegen den Nutzer, sondern gegen die Notbremse und gegen die
  bestehenden Grenzen (50 Seiten, 10 MB, Inhalts-Hash); die Grenzen für Notizbücher und Quellen je Notizbuch kommen aus [Plan 6](06-mutationstests-und-limits.md).
- **Gesamtgrenze je Tag als Notbremse (Tokens, alle Nutzer zusammen).** Das Guthaben ist fest und endet ohne Vorwarnung mit Fehlern bei allen. Der Wert folgt aus Messung und Guthaben. Ist er erreicht,
  sagt die Oberfläche das ehrlich („Heute ist das Kontingent der Demo aufgebraucht“), statt Fehler zu zeigen. Sie fängt auch Nutzer ab, die mehrere Konten anlegen.
- **Keine bestätigte E-Mail-Adresse zunächst.** Neu bewerten, wenn die Messung Missbrauch zeigt.
- **Gleichzeitigkeit:** Dafür gibt es bei NotebookLM keine veröffentlichte Zahl (nicht gefunden). Vorschlag: höchstens eine laufende Antwort je Nutzer und höchstens eine Studio-Erzeugung
  zugleich; die Oberfläche sperrt „Senden“ ohnehin, solange geantwortet wird.
- **Wortwahl in der Oberfläche:** Nicht „Token“ (Regel 10 in [AGENTS.md](../../AGENTS.md)), sondern „Fragen“ und „Ausgaben“.
- **Speicherung:** Tabelle `usage_events` mit Nutzer, Zweck, Tokens, Zeit; Ereignisse älter als 30 Tage werden gelöscht. Die Oberfläche liest `GET /api/usage` (Rest je Funktion, Freigabezeitpunkt).

Wie andere es machen (Quellen sind Drittseiten und die offizielle Doku von OpenAI; Zahlen ändern sich, vor Übernahme prüfen):

- **Claude (App):** Fenster von fünf Stunden, das mit der ersten Nachricht beginnt, dazu ein Wochenlimit; Anthropic nennt nur Vielfache, keine festen Zahlen; der Verbrauch steht auf einer Seite in den Einstellungen als Balken.
- **NotebookLM:** feste Zählung je Tag (Free laut Drittquellen 50 Chat-Anfragen, Pro 500) und Grenzen für Notizbücher und Quellen; nicht offiziell bestätigt.
- **OpenAI API:** Grenzen je Minute (Anfragen und Tokens) nach Stufe; jede Antwort trägt Header mit Rest und Rücksetzzeit (`x-ratelimit-remaining-tokens`, `x-ratelimit-reset-tokens`), ein 429 trägt `Retry-After`.
- Gemeinsam ist: ein gleitendes oder festes Fenster, ein Rest und eine Zeit bis zur Freigabe. Unsere Lösung folgt NotebookLM: Zählung je Tag, ein Hinweis erst am Ende, am Limit die Zeit der Freigabe.

## Fragen, die zuerst beantwortet werden müssen (Entscheidungen des Nutzers; oben beantwortet, der Rest ist Vorschlag)

**Budget und Risiko**

1. Wie viel darf das Live-Demo im Monat höchstens kosten? Ist bei Google ein hartes Budget-Limit gesetzt, und läuft eine automatische Aufladung?
2. Was ist das schlimmste Szenario, das du akzeptierst (ein Prüfer, der 200 Fragen stellt; ein Skript, das Gäste erzeugt)?
3. Was soll bei erreichtem Tageslimit des Anbieters oder Budgets passieren: nur diese Funktion sperren (zum Beispiel Studio), alles sperren, auf ein günstigeres Modell wechseln?

**Wer und was**

4. Wer darf nutzen: nur Gäste und eingeladene Konten, oder darf sich jeder registrieren? Braucht eine Registrierung eine bestätigte E-Mail-Adresse?
5. Gleiches Limit für Gäste und Konten, oder knapper für Gäste? Pro Konto, pro IP-Adresse oder beides (Gäste lassen sich beliebig oft neu starten, bis 20 je Stunde)?
6. Welche Zahl soll begrenzt werden: Anfragen, Tokens oder Euro? Nutzer verstehen „20 Fragen am Tag“, das Budget hängt an Tokens. Ein Zwischenschritt ist eine Zahl je Aktion
   (Frage, Studio-Ausgabe, Quelle) mit einem Gewicht aus der Messung.

**Form der Grenze**

7. Welches Zeitfenster: Stunde, Tag, Monat; gleitend oder fest (Mitternacht)? Gibt es zusätzlich eine kurze Grenze gegen Serien (zum Beispiel 10 Fragen je Minute)?
8. Wie viele Anfragen darf ein Nutzer gleichzeitig laufen lassen (Streams, Studio, Uploads)?
9. Was sieht der Nutzer: ein deutscher Hinweis mit Rest und Zeitpunkt der Freigabe, ein Verbrauchsbalken, eine Vorwarnung bei 80 %?
10. Gilt das nur im Demo oder auch später? Sollen die Werte aus der Umgebung kommen (anpassbar ohne Neubau) oder fest in `config/limits.ts` stehen?

**Teure Pfade und Eingaben**

11. Welche Aktionen sollen gesondert begrenzt werden (Studio, YouTube, Audio, Websuche, Übersicht neu erzeugen)?
12. Wie lang darf eine Antwort höchstens werden (`maxOutputTokens` je Aufruf)? Wie viel Quellenmaterial darf ein Nutzer insgesamt halten (Zeichen oder Chunks), weil Einbetten Tokens kostet und Speicher belegt?
13. Wie viele Notizbücher und Quellen je Notizbuch (überschneidet sich mit Plan 6, damit die Werte zusammenpassen)?

**Betrieb**

14. Wo wird der Verbrauch gespeichert (Datenbank-Tabelle, nicht Speicher), wie lange, und wer sieht ihn (nur Logs, ein Admin-Bericht)?
15. Ab welcher Schwelle soll ein Alarm kommen (Verbrauch am Tag, einzelner Nutzer über X Mal dem Durchschnitt), und wohin (Plan 1)?
16. Soll es einen Not-Aus per Umgebungsvariable geben (nicht gebaut), der Studio und Websuche abschaltet, ohne den Container zu stoppen?
17. Der Limiter liegt im Speicher: Reicht das, solange nur ein Container läuft, oder soll der Zähler in die Datenbank, weil ein Neustart alles zurücksetzt?

## Schritte

1. **Messen (ohne Entscheidung machbar):** Jeder Modellaufruf schreibt eine Zeile in `usage_events`: Nutzer, Zweck (Chat, Studio, Übersicht, Lesen, Embedding, Websuche), Modellrolle,
   Eingabe- und Ausgabe-Tokens (vom Anbieter gemeldet, sonst die Schätzung, mit Kennzeichen), Zeitpunkt. Keine Inhalte. Wertetabelle der Zwecke als `as const` in `packages/shared`.
2. **Auswerten:** Skript `pnpm report:usage` je Nutzer und Zweck für einen Zeitraum, mit durchschnittlichen Tokens je Aktion. Daraus entsteht die Tabelle „Kosten je Aktion“ (Preise vor dem Eintragen gegen
   die offizielle Preisseite prüfen, Regel 12 in [AGENTS.md](../../AGENTS.md)).
3. **Obergrenzen je Aufruf:** `maxOutputTokens` je Zweck aus der Config. Test: Der Aufruf trägt die Grenze.
4. **Entscheiden:** Die Fragen oben werden beantwortet, die Werte stehen im Commit-Text und in [PLAN.md](../PLAN.md).
5. **Begrenzen:** Prüfung in der Datenbank vor dem teuren Aufruf (Summe der Ereignisse im Fenster), Fehlercode `USAGE_LIMIT_REACHED` (Status 429) mit Zeitpunkt der Freigabe,
   deutscher Text in der Oberfläche, Knopf gesperrt statt ins Leere zu laufen.
6. **Fairness:** Eine Obergrenze gleichzeitiger Aufrufe je Nutzer vor dem Limiter, damit ein Nutzer die gemeinsame Warteschlange nicht füllt.

## Interfaces (Signaturen werden beim Umsetzen festgelegt, hier nur die Verträge)

- Schema `UsageEvent` und Wörterbuch `USAGE_PURPOSE` in `packages/shared`.
- Adapter hinter dem Kern: `recordUsage(event)` und `usedInWindow(userId, purpose?, since)` in `apps/api/src/db`; die Entscheidung „erlaubt oder nicht“ ist eine reine Funktion in `apps/api/src/core`
  (Verbrauch, Grenzen, Jetzt → erlaubt oder Freigabezeitpunkt).
- Fehlercode `USAGE_LIMIT_REACHED` im gemeinsamen Fehler-Wörterbuch.

## Testfälle (Liste)

- Jeder Zweck schreibt genau ein Ereignis mit Nutzer und Tokens, ohne Inhalt (Marker im Text darf nicht vorkommen).
- Die reine Funktion: genau an der Grenze erlaubt, eins darüber abgelehnt; Ereignisse außerhalb des Fensters zählen nicht; andere Nutzer zählen nicht; Freigabezeitpunkt ist der Ablauf des ältesten Ereignisses im Fenster.
- Route: Überschreiten liefert 429 mit Code und Freigabezeitpunkt, ohne dass das Modell aufgerufen wird (Aufrufzähler bleibt 0).
- Zwei gleichzeitige Anfragen bei Stand Grenze−1: höchstens eine geht durch (DB-Test).
- Gäste und Konten: jeweils eigenes Limit, wenn so entschieden.
- Oberfläche: Hinweistext deutsch, Knopf gesperrt, Wiederholen nach Freigabe möglich.

## Welcher Test wird rot

- Nutzerfilter in `usedInWindow` entfernen: Test „andere Nutzer zählen nicht“. `>=` zu `>`: Test „genau an der Grenze“. Prüfung vor dem Modellaufruf nach hinten schieben: Test „Modell nicht aufgerufen“.
- `recordUsage` aus einem Pfad entfernen: Test „jeder Zweck schreibt ein Ereignis“.
- Ohne Transaktion oder Sperre: Test „zwei gleichzeitige Anfragen“.

## Offen

- Alle Entscheidungen oben. Schritt 1 bis 3 sind unabhängig davon und können sofort beginnen.
- Der frühere Stand (Limits je Nutzer, Commit `ac6e991`) ist im Verlauf nachlesbar und kann als Ausgangspunkt dienen; er wurde auf Entscheidung des Nutzers entfernt, nicht wegen eines Fehlers.

## Schlüssel und Free Tier für die Evals (2026-10-15)

- Die Live-Evals (`pnpm eval:live`, `eval:studio`, `eval:overview`) lesen `EVAL_GEMINI_API_KEY` (`parseEvalEnv`), nie `GEMINI_API_KEY`; es gibt keinen Rückfall. So verbraucht ein Eval nie das bezahlte Guthaben des Betriebsschlüssels. Der Schlüssel kann aus einem Konto mit Free Tier stammen.
- Free-Tier-Werte aus der AI-Studio-Konsole, Stand 2026-09-29 (aus der Git-Historie, Commits `64b48c7`, `e3bafc6`): Flash 5 Anfragen/Min und 20 pro Tag, Flash-Lite 15 Anfragen/Min und 500 pro Tag, je 250K Tokens/Min. Nur ein Verlauf: Die offizielle Seite zu Rate Limits (ai.google.dev/gemini-api/docs/rate-limits, geprüft 2026-10-15) nennt keine Free-Tier-Zahlen und verweist auf die AI-Studio-Konsole (aistudio.google.com/rate-limit). Werte für `gemini-embedding-2` fehlen. Vor einem Lauf dort nachsehen (Regel 12).
- Im Free Tier sind Anfragen und Eingaben für Google nutzbar (Training); die Evals senden nur öffentliche Texte.

Höhen seit 2026-10-15: 40 Fragen, 10 Studio-Ausgaben, 2 Mio. Tokens am Tag. Grund: Die Seite ist eine Demo für Bewerbungen mit sehr wenigen Besuchern; ein Besucher, der alles ausprobiert, soll nicht an ein Limit stoßen, und zwei Besucher am selben Tag sollen ins Budget passen. Das Tagesbudget bleibt die eigentliche Sicherung des Guthabens (schlimmster Fall etwa 1,2 USD am Tag, geschätzt).

Erster Live-Eval (2026-10-15, Free-Tier-Schlüssel): 29 von 34 Fragen schlugen fehl, weil das Tageskontingent des Free Tiers nach etwa 9 Fragen erschöpft war (`CHAT_LIMIT_REACHED`/`GeminiError`) und vier Übersetzungsaufrufe vorher je 120 s in ein Timeout liefen. Die Trefferquoten dieses Laufs sind daher **keine Qualitätsmessung**. Nutzbar sind nur die Token-Zahlen der 5 beantworteten Fragen (`pnpm report:usage`: je Frage 6 623 Tokens Eingabe, 587 Ausgabe). Ein ganzer Lauf braucht für 34 Fragen mindestens 68 Modellaufrufe und passt nicht in ein Free-Tier-Tageskontingent.
