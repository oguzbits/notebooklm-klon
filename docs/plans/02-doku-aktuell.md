# Plan 2: Doku bleibt aktuell

## Ist

- `docs/PLAN.md` ist veraltet. Beispiel für den Fehlertyp: `docs/BACKLOG.md` nannte eine Testzahl, die von der Ausgabe von `pnpm test` abwich.
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
- Absoluter Rechnerpfad unter dem Home-Verzeichnis wird gemeldet.
- Eine Zahl vor „Tests“ wird gemeldet; „Tests laufen offline“ nicht.
- Ausnahme: Zeilen im Codeblock mit Kommentar `<!-- audit-docs: ignore -->` (nur wenn nötig).

## Welcher Test wird rot

- Prüfung der Linkziele entfernen: Test „Link auf nicht vorhandene Datei“. Entsprechend je Regel.

## Umsetzung

1. Skript und Tests. 2. Treffer beheben (PLAN.md kürzen, BACKLOG-Zahl entfernen). 3. In `pnpm check` einhängen.
2. DoD-Zeile „Docs: updated“ bleibt Pflicht bei geändertem Vertrag.

## Teil B: Inhalt bleibt wahr (neu, 2026-10-14)

Teil A (oben) prüft nur Verweise. Ob ein Satz noch stimmt, prüft er nicht. Am 2026-10-14 stand in [PLAN.md](../PLAN.md) unter anderem: Free-Tier-Limits,
„3 Uploads pro Nutzer und Tag“, „Quoten pro Nutzer“ (2026-10-03 entfernt), ein Embedding-Fallback und ein Studio-Modell (beides nie gebaut). Alles verweisfrei, alles falsch.
Eine Maschine kann das nicht sicher erkennen. Vier Schichten verkleinern das Risiko, jede fängt etwas anderes:

1. **Fakten kommen aus dem Code, nicht aus der Hand.** `pnpm docs:generate` schreibt Tabellen zwischen Marken (`<!-- generated:limits -->` bis `<!-- /generated -->`) aus
   `LIMITS`, `PROVIDER_LIMITS`, dem Env-Schema (Namen, Pflicht oder optional), den Modellrollen und den Befehlen in `package.json`. `audit:docs` führt die Erzeugung im Prüfmodus
   aus und schlägt fehl, wenn die Datei abweicht. Limits, Variablen und Befehle können so nicht veralten.
2. **Code-Pfad bindet Doku-Datei.** `docs/docs-map.json` ordnet Pfaden Dokumente zu (`config/limits.ts` und `config/env.ts` an PLAN.md, `deploy/**` an DEPLOYMENT.md, `db/schema.ts` und
   `packages/shared/src/**` an PLAN.md). Ein Commit, der einen Pfad ändert, muss das Dokument mitändern oder in der Nachricht `Docs: n/a, <Grund>` tragen. Geprüft im Commit-Hook
   und im CI (Spanne der Commits). Das erzwingt, dass jemand hinsieht; es beweist nicht, dass der Text stimmt.
3. **Datierte Aussagen.** Jedes Dokument hat unter dem Titel `Stand: <Datum>`; Aussagen über Zustände („gebaut“, „entfernt“, „offen“) nennen die Quelle (Datei oder Commit).
   `audit:docs` meldet ein Dokument, dessen `Stand` älter ist als die letzte Änderung eines zugeordneten Code-Pfads (Schicht 2) und das nicht mitgeändert wurde.
4. **Abgleich vor jedem Abschluss.** Am Ende einer Funktion und vor jeder Abgabe läuft ein Abgleich Dokument gegen Code: jede Tatsachenbehauptung in PLAN.md und README gegen den Code prüfen,
   Liste der Abweichungen, Behebung im selben Zug. Gemacht von einem Agenten mit der Vorgabe „nur lesen, belegen mit Datei und Zeile“. In die DoD-Quittung kommt die Zeile
   „Docs: abgeglichen am <Datum>, Abweichungen: <n> behoben“. Optional nächtlich im CI, wenn der Aufwand es wert ist.

Zusätzlich: Dokumente teilen sich nach Zweck. **Kontext** (Ziel, Schichten) ändert sich selten und steht in PLAN.md. **Stand** (was gebaut ist, Zahlen, offene Punkte) steht in BACKLOG.md und ist datiert.
**Verlauf** (Spike-Ergebnisse, Entscheidungen) wird nie „aktuell“ gepflegt, sondern nur ergänzt und trägt sein Datum. Aussagen aus dem Verlauf werden in PLAN.md nicht wiederholt, sondern verlinkt.

### Testfälle Teil B

- Eine Tabelle zwischen den Marken, die vom Code abweicht, wird gemeldet; nach `docs:generate` nicht mehr.
- Eine Änderung an `config/limits.ts` ohne Änderung von PLAN.md und ohne `Docs: n/a` lässt den Prüfer fehlschlagen; mit einem der beiden besteht sie.
- Ein Pfad außerhalb der Zuordnung löst nichts aus.
- Ein Dokument mit älterem `Stand` als die letzte Änderung eines zugeordneten Pfads wird gemeldet.

### Welcher Test wird rot

- Prüfmodus der Erzeugung entfernen: Test „Tabelle weicht ab“. Zuordnung ignorieren: Test „Änderung ohne Doku“. Prüfung des Datums entfernen: Test „älterer Stand“.

### Offen

- Reichen die Schichten 1 bis 3, oder soll Schicht 4 zusätzlich nächtlich im CI laufen (Kosten für den Agenten)?
- Welche Zuordnungen in `docs-map.json` stehen am Anfang (Vorschlag oben)?
