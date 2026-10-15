# Plan 6: Mutationstests und Limits

## Mutationstests

- Ziel: Tests finden, die nie fehlschlagen können (AGENTS.md verlangt das von Hand; hier automatisiert).
- Werkzeug: StrykerJS mit dem Vitest-Runner (unterstützt inkrementellen Modus). Version und Konfiguration vor dem Einbau gegen die aktuelle Doku prüfen.
- Umfang: nur `apps/api/src/core` (rein, schnell, Logik mit Verzweigungen). Nicht `routes`, `db`, `web`.
- Lauf: nicht im Pre-commit. Nächtlicher oder manueller CI-Lauf, inkrementell, Bericht als Artefakt.
- Schwelle: zuerst nur messen. Danach `break` knapp unter dem Ist-Wert setzen und schrittweise anheben. Überlebende Mutanten werden Tests oder toter Code.
- Testfälle für die Einrichtung: ein absichtlich ungetesteter Zweig überlebt und wird im Bericht genannt.

## Limits statt Seitenaufteilung

- Ist: `listNotebooks` lädt alle Notebooks, keine Obergrenze je Nutzer.
- Original (Stand der Recherche, vor Umsetzung neu prüfen): Free 100 Notebooks und 50 Quellen je Notebook, Plus 200/100, Pro 500/300.
  Das Original begrenzt, statt zu blättern. Bei unserer Größe ist eine Grenze einfacher und ehrlicher als Seitenaufteilung.
- Vorschlag: Obergrenzen je Nutzer in `config/limits.ts`: Notebooks und Quellen je Notebook. Werte entscheidest du.
- Verhalten: Überschreiten liefert Fehlercode (neuer Eintrag im gemeinsamen Fehler-Wörterbuch, Statuscode 409), die Oberfläche zeigt deutschen Text
  („Du hast die Höchstzahl an Notebooks erreicht. Lösche eines, um ein neues anzulegen.“) und sperrt den Knopf, statt ins Leere zu laufen.
- Prüfung in der Datenbank atomar (Zählen und Einfügen in einer Transaktion), damit zwei gleichzeitige Anfragen die Grenze nicht umgehen.

## Testfälle

- Notebook Nummer Grenze+1 wird abgelehnt (409 mit Code), Nummer Grenze geht durch.
- Zwei gleichzeitige Anlagen bei Stand Grenze−1: genau eine gelingt (DB-Test).
- Grenze zählt nur eigene Notebooks, nicht die anderer Nutzer.
- Oberfläche: Knopf „Neues Notebook“ gesperrt mit Hinweis bei erreichter Grenze; Fehlertext deutsch.

## Welcher Test wird rot

- Vergleich `>=` zu `>` ändern: Test „Grenze+1 abgelehnt“. Zählung ohne Nutzerfilter: Test „nur eigene“. Ohne Transaktion: Test „gleichzeitig“.

## Stand Mutationstests

- Gebaut: `pnpm mutation` (Konfiguration in [stryker.config.json](../../stryker.config.json), Vitest-Konfiguration in [config/vitest.mutation.config.ts](../../config/vitest.mutation.config.ts)). Lauf dauert etwa 2 Minuten; CI nur manuell oder wöchentlich ([mutation.yml](../../.github/workflows/mutation.yml)), Bericht als Artefakt.
- Ausgangswert (2026-10-15): 79,3 % Mutation Score (234 überlebte Mutanten, 35 ohne Abdeckung). Schwächste Dateien: `notebook-limit.ts` (kein Test), `studio-prompt.ts`, `chat-prompt.ts` (je ~55 %).
- Nach dem ersten Abarbeiten der Überlebenden in Dateien mit Logik (ssrf, Dateitypen, Zahlenabgleich): 81,5 %, `break` steht auf 80. Der Rest sind meist Prompt-Texte, Fehlermeldungen und gleichwertige Mutanten; `break` nur anheben, wenn echte Überlebende dazu kommen.
- Stryker-Runner 10.0.0 passt den Namensfilter auf Vitest 5 nicht an ([Issue 6210](https://github.com/stryker-mutator/stryker-js/issues/6210)): jeder Mutant überlebt, weil kein Test läuft. Ein pnpm-Patch (`patches/`) verbindet die Namensteile mit `' > '`. Patch entfernen, sobald der Runner das behebt.
- Die Vitest-Konfiguration nutzt `process.cwd()` statt Dateipfaden: Stryker lädt sie aus dem echten Projekt, führt aber in einer Sandbox-Kopie aus.
