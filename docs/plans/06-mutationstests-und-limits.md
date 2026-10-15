# Plan 6: Mutationstests und Limits

Stand: 2026-10-15. Beide Teile gebaut.

## Mutationstests

- `pnpm mutation`: StrykerJS mit Vitest-Runner auf `apps/api/src/core`. Konfiguration [stryker.config.json](../../stryker.config.json) und
  [config/vitest.mutation.config.ts](../../config/vitest.mutation.config.ts); Lauf etwa 2 Minuten. CI nur manuell oder wöchentlich ([mutation.yml](../../.github/workflows/mutation.yml)), Bericht als Artefakt.
- Ausgangswert 79,3 %, nach dem Abarbeiten der Überlebenden in `ssrf`, Dateitypen und Zahlenabgleich 81,5 %. `break` steht auf 80 und wird nur angehoben,
  wenn echte Überlebende dazukommen. Der Rest sind meist Prompt-Texte, Fehlermeldungen und gleichwertige Mutanten.
- Der Stryker-Runner 10.0.0 passt den Namensfilter nicht an Vitest 5 an ([Issue 6210](https://github.com/stryker-mutator/stryker-js/issues/6210)):
  jeder Mutant überlebte, weil kein Test lief. Ein pnpm-Patch in `patches/` verbindet die Namensteile mit `' > '`; entfernen, sobald der Runner es behebt.
- Die Vitest-Konfiguration nutzt `process.cwd()`, weil Stryker in einer Sandbox-Kopie ausführt.

## Limits statt Seitenaufteilung

- 100 Notebooks je Nutzer und 50 Quellen je Notebook (`config/limits.ts`), geprüft atomar in der Datenbank (Zählen und Einfügen in einer Transaktion).
- Überschreiten liefert HTTP 409 mit eigenem Fehlercode; die Oberfläche zeigt deutschen Text und sperrt „Neues Notebook“.
- Vorbild ist NotebookLM (Free: 100 Notebooks, 50 Quellen); eine Grenze ist einfacher als Seitenaufteilung.
