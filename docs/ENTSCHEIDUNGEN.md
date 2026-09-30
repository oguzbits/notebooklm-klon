# Entscheidungen

Kleine Entscheidungen, die der Agent selbst getroffen hat, mit Begründung. Große Entscheidungen
(Umfang, Kosten, Datenschutz) liegen beim Nutzer. Der Nutzer liest die Liste und korrigiert.

Format: Datum, Entscheidung, Begründung, was sie später ändern würde.

## 2026-09-30

- **Regeln gelockert (auf Wunsch des Nutzers):** Commits und Pushes sind erlaubt, Force-Push und
  `--no-verify` bleiben gesperrt. Abhängigkeiten dürfen ohne Rückfrage hinzukommen. Begründung:
  Der Agent soll ohne Rückfragen durcharbeiten können. Die Husky-Hooks bleiben die Qualitätssperre.
