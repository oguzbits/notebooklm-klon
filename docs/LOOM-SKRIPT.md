# Loom-Skript (6 bis 7 Minuten)

Ziel: Entscheidungen erklären, nicht Funktionen aufzählen. Vorher einmal komplett üben, mit dem Live-Deployment und einem frischen Konto. Die Zahlen stammen aus [SPIKE-ERGEBNISSE.md](SPIKE-ERGEBNISSE.md) und sind Einzelmessungen.

## 1. Ziel und Umfang (30 Sekunden)

- Aufgabe: NotebookLM-Klon in production-ready Qualität. Kern: ein Chat, der nur auf eigenen Quellen antwortet und jede Aussage belegt.
- Gebaut: Quellen (PDF, DOCX, TXT, MD, Link), Chat mit Streaming und belegten Zitaten, Notizen, Studio (Bericht, Karteikarten, Quiz, Mindmap, Datentabelle). Den Rest zeigt der Live-Test.
- Bewusst nicht gebaut: Audio, Präsentation, Video, Infografik, Daumen an Antworten. Grund: wenige Funktionen in hoher Qualität statt vieler halber.

## 2. Vorgehen und Architektur (1:30 Minuten)

- **Agentischer Workflow zeigen:** [AGENTS.md](../AGENTS.md) (Schichten, Produkt-Invarianten), `pnpm check` als Gate, Hooks, ein Thema pro Commit, Test zuerst.
- **Architektur:** README-Diagramme. Ein Container, eine Datenbank für alles (pgvector, Volltext, Jobs, Sitzungen). Verträge nur in `packages/shared`.
- **Spike mit Zahlen** (ein halber Tag vor dem Bau):
  - PDF-Parsing: Gemini Flash-Lite fand 11 von 11 Ankern, der lokale Parser 10 von 11 und keine Tabellenstruktur. Der Scan wurde zu 99,9 % gelesen.
  - Einbettungen: 17 gegen 16 von 18 Fragen in den Top 5, also Gleichstand. Regel: bei Gleichstand das neuere Modell.
  - Chat: Zitate waren zu 100 % gültig. **Aber:** ein gültiges Zitat belegt keine richtige Antwort. Eine Zahl kam falsch zurück, weil die Suche den Treffer erst auf Rang 6 fand. Konsequenz: Hybridsuche statt größeres Modell, und beides getrennt messen.
- **Zitat-Vertrag:** Das Modell sieht nur Labels (c1 bis c8), der Server bildet sie auf echte IDs ab und verwirft alles, was nicht im Kontext war.

## 3. Live-Test (3:30 Minuten)

Vorbereitung: Demo-Notebook ist da, ein kleines PDF mit Tabelle bereithalten (zum Beispiel Quartalsumsatz nach Stadt). Alles läuft live gegen die echten Dienste (Gemini, PostgreSQL, Objektspeicher), nichts ist gemockt. Nur das Demo-Notebook ist vorbereiteter Inhalt, erzeugt mit echten Modellaufrufen.

**Zeit sparen:** Den Bericht (Schritt 8) gleich nach dem Öffnen des Notebooks starten. Er braucht über eine Minute und ist fertig, wenn du dort ankommst. **Vor „Notebook erstellen“ die Quellenansicht schließen** (bekannter Fehler: sonst bleibt die alte Ansicht im neuen Notebook hängen).

1. Anmelden mit dem Demo-Zugang. Notebook-Liste, Demo-Notebook öffnen.
2. **Quellenübersicht** aufklappen (Zusammenfassung, Schlüsselthemen). Vorschlagsfrage anklicken.
3. Antwort **streamt**. Chip mit der Maus berühren: Popup mit Quelle und Textstelle. Klicken: Quelltext mit markierter Stelle.
4. Eine **deutsche Frage auf die englische Quelle** stellen (RAG-Übersicht).
5. Quelle **abwählen** und dieselbe Frage stellen: Die Antwort stützt sich nur noch auf die gewählten Quellen. Bei Zeitnot weglassen.
6. Im zweiten Notebook ein PDF hochladen: Status „Wird gelesen“, dann bereit. Der Upload dauert unter einer Minute, in der Zeit über die Entscheidungen sprechen. Danach eine Frage zu einer Tabelle.
7. Antwort als **Notiz** speichern, im Tab „Notizen“ zeigen, Chip dort anklicken.
8. **Studio** zeigen: den früh gestarteten Bericht öffnen, Chip anklicken. Karteikarten oder Quiz nur, wenn das Kontingent reicht.
9. Optional (in der Aufnahme weglassen): nicht unterstützte Datei hochladen, um die verständliche Fehlermeldung zu zeigen.

## 4. Trade-offs und Grenzen (1 Minute)

- Wo bricht es zuerst? Kontingent im kostenlosen Tarif (Gegenmittel: Inhalts-Hash, Ratenbegrenzer, Kontingent pro Nutzer, Demo-Notebook). Danach Fragen in anderer Sprache als die Quelle (Textsuche nur Rauschen, Gewicht nicht durch Messung begründet).
- Was ich als Nächstes ändern würde: mehr Golden Questions, Abgleich der PDF-Ausgabe mit einem lokalen Parser, Ratenbegrenzer in die Datenbank, sobald es mehr als eine Instanz gibt.
- Ehrlich sagen: Berichte und Uploads brauchen etwa eine Minute, weil echte Modelle arbeiten. Der Server läuft dauerhaft auf Hetzner, es gibt keinen Kaltstart.

## Vor der Aufnahme prüfen

- [ ] Demo-Konto meldet sich an, Demo-Notebook ist vorbefüllt und die Übersichten sind da
- [ ] Ein Durchlauf mit den Fragen aus Abschnitt 3 klappt, Kontingent des Demo-Projekts reicht
- [ ] `pnpm eval:live` ist einmal gelaufen, die Zahlen liegen bereit (Datei in `reports/`)
- [ ] README enthält Live-Link, Demo-Zugang und Video-Link
- [ ] Fenster vergrößert, Benachrichtigungen aus, keine privaten Daten im Bild
