# Verbesserungspläne

Stand 2026-10-14, aus der Besprechung der neun Punkte. Jeder Plan nennt Interfaces, Verhaltensregeln, Testfälle als Liste und
je Schutzfunktion den Test, der rot werden muss. Code steht hier nicht; er entsteht beim Umsetzen testgetrieben.
Jede Zahl und jeder Modell- oder Bibliothekswert ist vor der Umsetzung gegen die aktuelle Quelle zu prüfen
(Regel 12 in [AGENTS.md](../../AGENTS.md)).

| Nr. | Plan                                                             | Warum an dieser Stelle                                          | Entscheidung offen                 |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| 1   | [Beobachtbarkeit](01-beobachtbarkeit.md)                         | Ohne Logs lässt sich kein gemeldeter Fehler untersuchen         | Sentry: ja (DSN fehlt), SSH lesend |
| 2   | [Doku bleibt aktuell](02-doku-aktuell.md)                        | Veraltete Doku wurde bereits bemerkt; billig und sofort wirksam | nein                               |
| 3   | [Eval](03-eval.md)                                               | Alle Qualitätsentscheidungen (4, 5) brauchen ein Messgerät      | Korpus im Repo (öffentliche Texte) |
| 4   | [Doppelte Werte und Temperatur](04-doppelte-werte-temperatur.md) | Klein, aber nur mit Eval belegbar                               | nein                               |
| 5   | [RAG-Experimente](05-rag-experimente.md)                         | Je Experiment eine Messung gegen das Eval                       | nein                               |
| 6   | [Mutationstests und Limits](06-mutationstests-und-limits.md)     | Unabhängig, kann parallel laufen                                | Höhe der Limits                    |
| 7   | [Nutzung, Limits und Kosten](07-nutzung-und-kosten.md)           | Ohne Verbrauchszählung kein begründetes Limit; Schritt 1 sofort | Höhe des Limits (nach Messung)     |

Reihenfolge: 1, 2 zuerst und unabhängig voneinander. 3 vor 4 und 5. 6 jederzeit. 7: Schritt 1 bis 3 (messen) sofort, danach Entscheidungen.

Stand der Umsetzung: Plan 1 gebaut (ohne Sentry und SSH). Plan 2 Teil A (mechanische Prüfung `pnpm audit:docs`) gebaut, Teil B offen.
