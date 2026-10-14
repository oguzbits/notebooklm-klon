# Plan 2: Doku bleibt aktuell

## Ist

- `docs/PLAN.md` ist veraltet. Beispiel für den Fehlertyp: `docs/BACKLOG.md` nennt „1179 Tests“, `pnpm test` meldet am 2026-10-14 1151.
- Zahlen, Stände und Befehle stehen mehrfach und werden einzeln gepflegt.

## Regeln

1. **Keine Zählwerte in der Doku** (Tests, Dateien, Zeilen). Wer sie braucht, führt den Befehl aus.
2. **Eine Quelle je Fakt**: Befehle stehen in `package.json` und AGENTS.md, Verträge im Code (`packages/shared`), Entscheidungen im Commit-Text.
   Die Doku verlinkt dorthin.
3. `docs/PLAN.md` wird zum kurzen, stabilen Kontext (Ziel, Stack, Schichten) und verliert alles, was sich aus dem Code ableiten lässt.
4. Ein Prüfskript `audit:docs` läuft in `pnpm check`.

## Interface: `scripts/audit/audit-docs.mjs`

- Prüft in allen Markdown-Dateien: relative Links zeigen auf vorhandene Dateien und Anker; in Backticks genannte `pnpm`-Befehle gibt es in einer `package.json`;
  genannte Pfade unter `apps/`, `packages/`, `deploy/` existieren; keine absoluten Rechnerpfade (Regel 13); keine Zeile der Form „<Zahl> Tests“.
- Ausgabe wie `audit:magic`: eine Zeile bei Erfolg, sonst Liste mit Datei und Zeile.

## Testfälle

- Link auf nicht vorhandene Datei wird gemeldet.
- `pnpm gibt-es-nicht` in Backticks wird gemeldet.
- Absoluter Pfad `/Users/...` wird gemeldet.
- „1179 Tests“ wird gemeldet; „Tests laufen offline“ nicht.
- Ausnahme: Zeilen im Codeblock mit Kommentar `<!-- audit-docs: ignore -->` (nur wenn nötig).

## Welcher Test wird rot

- Prüfung der Linkziele entfernen: Test „Link auf nicht vorhandene Datei“. Entsprechend je Regel.

## Umsetzung

1. Skript und Tests. 2. Treffer beheben (PLAN.md kürzen, BACKLOG-Zahl entfernen). 3. In `pnpm check` einhängen.
2. DoD-Zeile „Docs: updated“ bleibt Pflicht bei geändertem Vertrag.
