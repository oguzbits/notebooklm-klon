# Loom-Skript (höchstens 10 Minuten)

Gliederung nach [PLAN.md](PLAN.md#tagesplan). Vorher einmal komplett üben, mit dem Live-Deployment und einem frischen Konto. Die Zahlen stammen aus [SPIKE-ERGEBNISSE.md](SPIKE-ERGEBNISSE.md) und sind Einzelmessungen.

## 1. Ziel und Umfang (1 Minute)

- Aufgabe: NotebookLM-Klon in production-ready Qualität. Kern: ein Chat, der nur auf eigenen Quellen antwortet und jede Aussage belegt.
- Gebaut: Anmeldung, Notizbücher, Quellen (PDF, DOCX, TXT, MD, Link), Chat mit Streaming, nummerierte Zitate mit Hover und Sprung zur Textstelle, Übersicht pro Quelle, Vorschlagsfragen, Notizen.
- Bewusst nicht gebaut: Studio (Bericht, Karteikarten, Quiz), Chat-Konfiguration, Mindmap. Grund: wenige Funktionen in hoher Qualität statt vieler halber.

## 2. Vorgehen und Architektur (3 Minuten)

- **Agentischer Workflow zeigen:** [AGENTS.md](../AGENTS.md) (Schichten, Produkt-Invarianten, Definition of Done), `pnpm check` als Gate, Hooks, ein Thema pro Commit, Test zuerst.
- **Architektur:** README-Diagramme. Ein Container, eine Datenbank für alles (pgvector, Volltext, Jobs, Sitzungen). Verträge nur in `packages/shared`.
- **Spike mit Zahlen** (ein halber Tag vor dem Bau):
  - PDF-Parsing: Gemini Flash-Lite fand 11 von 11 Ankern, der lokale Parser 10 von 11 und keine Tabellenstruktur. Der Scan wurde zu 99,9 % gelesen.
  - Einbettungen: 17 gegen 16 von 18 Fragen in den Top 5, also Gleichstand. Regel: bei Gleichstand das neuere Modell.
  - Chat: Zitate waren zu 100 % gültig. **Aber:** ein gültiges Zitat belegt keine richtige Antwort. Eine Zahl kam falsch zurück, weil die Suche den Treffer erst auf Rang 6 fand. Konsequenz: Hybridsuche statt größeres Modell, und beides getrennt messen.
- **Zitat-Vertrag:** Das Modell sieht nur Labels (c1 bis c8), der Server bildet sie auf echte IDs ab und verwirft alles, was nicht im Kontext war.

## 3. Live-Test (4 Minuten)

Vorbereitung: Beispiel-Notizbuch ist da, ein zweites, leeres Notizbuch für den Upload, ein kleines PDF mit Tabelle bereithalten.

1. Anmelden mit dem Demo-Zugang. Notizbuch-Liste, Beispiel-Notizbuch öffnen.
2. **Quellenübersicht** aufklappen (Zusammenfassung, Schlüsselthemen). Vorschlagsfrage anklicken.
3. Antwort **streamt**. Chip mit der Maus berühren: Popup mit Quelle und Textstelle. Klicken: Quelltext mit markierter Stelle.
4. Eine **deutsche Frage auf die englische Quelle** stellen (RAG-Übersicht).
5. Quelle **abwählen** und dieselbe Frage stellen: Die Antwort stützt sich nur noch auf die gewählten Quellen.
6. Im zweiten Notizbuch ein PDF hochladen: Status „Wird gelesen“, dann bereit. Danach eine Frage zu einer Tabelle.
7. Antwort als **Notiz** speichern, im Tab „Notizen“ zeigen, Chip dort anklicken.
8. Optional: nicht unterstützte Datei hochladen, um die verständliche Fehlermeldung zu zeigen.

## 4. Trade-offs und Grenzen (1 Minute)

- Wo bricht es zuerst? Kontingent im kostenlosen Tarif (Gegenmittel: Inhalts-Hash, Ratenbegrenzer, Kontingent pro Nutzer, Beispiel-Notizbuch). Danach Fragen in anderer Sprache als die Quelle (Textsuche nur Rauschen, Gewicht nicht durch Messung begründet).
- Was ich als Nächstes ändern würde: mehr Golden Questions, Abgleich der PDF-Ausgabe mit einem lokalen Parser, Ratenbegrenzer in die Datenbank, sobald es mehr als eine Instanz gibt.
- Ehrlich sagen: Der Kaltstart des kostenlosen Hostings dauert etwa eine Minute.

## Vor der Aufnahme prüfen

- [ ] Demo-Konto meldet sich an, Beispiel-Notizbuch ist vorbefüllt und die Übersichten sind da
- [ ] Ein Durchlauf mit den Fragen aus Abschnitt 3 klappt, Kontingent des Demo-Projekts reicht
- [ ] `pnpm eval:live` ist einmal gelaufen, die Zahlen liegen bereit (Datei in `reports/`)
- [ ] README enthält Live-Link, Demo-Zugang und Video-Link
- [ ] Fenster vergrößert, Benachrichtigungen aus, keine privaten Daten im Bild
