# Abgleich mit dem Original (Gemini Notebook, früher NotebookLM)

Dieses Dokument ist der Plan und die Checkliste für die Oberfläche: Was das Original tut (gemessen), was der
Nachbau heute tut, was geändert wird und ob es erledigt ist. Es wird mit jeder Änderung fortgeschrieben.
Die Rohdaten (Messungen, Screenshots) liegen lokal in `spikes/reference/` und sind nicht im Repo; die
Entscheidungen stehen in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md).

## 1. Regeln des Abgleichs

- **Messen statt schätzen.** Jeder Wert kommt aus den berechneten Stilen des Originals (Fenster 1440x900,
  Zoom 100 %, hell und dunkel; Handy 390x844). Kein Wert aus dem Gedächtnis.
- **Nur lesen.** Im Original wird nichts angelegt, gelöscht oder verändert; Netzdrosselung und Emulation werden
  danach zurückgesetzt.
- **Nachweis pro Bereich:** (1) Zahlenvergleich der berechneten Stile Original gegen Nachbau, (2) Screenshot
  nebeneinander, hell und dunkel, (3) Test, wo sich das Verhalten prüfen lässt (jsdom misst keine Geometrie).
- **Was es bei uns nicht gibt, wird nicht vorgetäuscht.** Kein Schalter ohne Funktion, keine Kachel für ein
  Format, das wir nicht erzeugen. Die Abweichungen stehen in Abschnitt 4.
- **Texte bleiben deutsch und im Du**, Begriffe wie im Original („Quellen“, „Studio“, „Notizen“, „Chat“), ohne
  Fachwörter (Regel 10 in [AGENTS.md](../AGENTS.md)).

## 2. Abgleichtabelle

Status: ✔ gleich, ◐ teilweise, ✘ fehlt oder weicht ab, ➜ in Arbeit.

Hinweis: Beim Einbau der Tooltips fiel auf, dass `tailwind-merge` die eigenen Schriftgrößen (`text-ui`, `text-small`) und
Gewichte nicht kannte und sie beim Zusammenführen mit einer Textfarbe stillschweigend verwarf. Das ist behoben
(`apps/web/src/lib/utils.ts`), und jede Stelle mit dieser Kombination wird dadurch jetzt wie gedacht gesetzt.

### 2.1 Raster und Abstände (Notizbuchseite, ab 1056 px)

| Was                     | Original (gemessen)                                                                                              | Nachbau vorher                             | Maßnahme                                                            | Status |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- | ------ |
| Außenrand               | Container x=12, Breite Fenster − 24; Panels enden 12 px über dem Fensterrand                                     | links 12, rechts 12                        | Container mit 12 px links, Breite `100vw − 24`                      | ✔      |
| Spalten                 | 25 % / 48 % / 25 % des Containers plus zwei Trenner à 8 px; die restlichen 2 % (minus 16 px) bleiben rechts frei | 24,58 vw / Rest / 24,58 vw, Lücke 8        | Spalten nach dieser Regel (1440: 354 / 679,7 / 354, Rand rechts 24) | ✔      |
| Panel                   | Radius 32, Innenabstand 8 + 1 px transparenter Rahmen, Unterkante 12 px über dem Fensterrand                     | Innenabstand 8 ohne Rahmen (338 statt 336) | 1 px transparenter Rahmen                                           | ✔      |
| Panelkopf Quellen       | 336x40 bei y=73, Innen 8 8 8 12, Titel 15/20, Umschalter 20 px Icon in 48-px-Fläche                              | 338x40                                     | Breite über den Rahmen; Umschalter prüfen                           | ✔      |
| Panelkopf Studio        | 336x**36** bei y=73; Kacheln beginnen bei y=109                                                                  | 40 hoch, Kacheln bei 112                   | Kopf 36 hoch                                                        | ✔      |
| Studio, Abstand Kacheln | Raster Lücke 8; danach 12 bis zur Liste                                                                          | 16                                         | 12                                                                  | ✔      |
| Quellenliste            | Zeile 36 hoch, Radius 8, Innen 0 8, Lücke 12; Zeilenabstand 0                                                    | 65 hoch (mit „Übersicht“-Zeile)            | Übersicht nur im Reader; Zeile 36                                   | ✔      |
| Quellenkopfzeile        | „Alle auswählen“ links von Sortier-Icon, rechts Checkbox, 40 hoch, Innen 4 8 4 4                                 | rechtsbündig „Alle Quellen auswählen“      | Zeile wie im Original                                               | ✔      |
| Chat, Seiteneinzug      | 8 (Inhalt) + 12 + 24 (Paar) = 44 je Seite; Text 5 px weiter; Antwort rechts 32 zusätzlich                        | 40                                         | 44                                                                  | ➜      |
| Nutzerblase             | Fläche `surface-dim`, Radius 40, Innen 20 28, Text 14/24, links 32 Abstand                                       | Text 16, andere Polsterung                 | wie Original                                                        | ➜      |
| Zeitstempel             | „Heute • 20:51“ 12/16, Gewicht 500, Abstand 0,096, zentriert, Abstand 16 / 12                                    | fehlt                                      | ergänzen (Zeit der Frage)                                           | ➜      |
| Eingabeleiste           | Container 660 (Innen 0 16) ⇒ Eingabe **628x64**, Radius 32, Schatten `0 0 20px`; Hinweistext 13/17, Innen 12 0   | 660 breit                                  | 628 + Hinweistext am Fensterrand (Chat reicht bis 900)              | ✔      |
| Chat oben / unten       | 28 px Verlauf oben (Seitenfarbe → transparent); Studio unten 28 px Verlauf                                       | kein Verlauf                               | beide Verläufe                                                      | ✔      |

### 2.2 Kopfzeile

| Was      | Original                                                                                          | Nachbau vorher             | Maßnahme                                                                   | Status |
| -------- | ------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------- | ------ |
| Titel    | Eingabe 22/36, x=76 (Logo 36 bei x=20, Lücke 12, Innen 8), bearbeitbar                            | h1 20 px, nicht editierbar | 22/36; Umbenennen über das Feld (sofern Endpunkt vorhanden)                | ✔      |
| Rechts   | „+ Notebook erstellen“ (Text-Pille), Freigeben, ⋮ Konfiguration, ⚙, PRO, Apps, Avatar 40; Lücke 8 | „Einstellungen“ + Avatar   | „+ Notizbuch erstellen“, ⋮ (Chat konfigurieren …), ⚙ (Darstellung), Avatar | ◐      |
| Tooltips | „Weitere Optionen“, „Einstellungen“ …                                                             | keine                      | über den neuen Tooltip                                                     | ✔      |

### 2.3 Zeiger, Tooltips, Fokus

| Was       | Original                                                                                                                                                 | Nachbau vorher                            | Maßnahme                                                         | Status |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- | ------ |
| Zeiger    | `pointer` auf Kacheln, Zeilen, Icon-Buttons, Pillen                                                                                                      | überall `default` (Tailwind-v4-Preflight) | Basisregel für aktive Buttons, Links, `role=button`              | ✔      |
| Tooltip   | Inverse Fläche (hell #303030/#f2f2f2, dunkel #e3e3e3/#303030), 13/16, Radius 4, Innen 4 8, max 200, 0 ms, 8 px unter dem Element, 150 ms ein / 90 ms aus | keiner                                    | `Tooltip`-Baustein; Kacheln, Icon-Buttons, Quellen-/Ausgabetitel | ✔      |
| Fokusring | 3 px, außen, folgt der Form                                                                                                                              | gleich                                    | –                                                                | ✔      |

### 2.4 Ladezustände

| Was            | Original                                                                                             | Nachbau vorher                     | Maßnahme                                     | Status |
| -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------- | ------ |
| Art            | Schimmer (Verlauf 90°, 25/37/63 %, 400 %, 1,4 s), kein Pulsieren; Form wie der spätere Inhalt        | `animate-pulse`, graue Balken      | Schimmer-Baustein mit Tokens                 | ✔      |
| Startseite     | Kartenraster                                                                                         | 3 Balken                           | 4 Karten 272x185, Radius 40                  | ✔      |
| Notizbuch      | Layout steht sofort; Chat: Spinner + 7 Balken (46 hoch, Lücke 8, 85–100 %); Studio: 5 Zeilen 64 hoch | ganze Seite durch 3 Balken ersetzt | Layout bleibt, Platzhalter an Ort und Stelle | ✔      |
| Anmeldeprüfung | leere Fläche                                                                                         | 3 Balken                           | leere Fläche mit dünnem Spinner              | ✔      |
| Reader, Popup  | Spinner in der Übersichtskarte; Zeilen                                                               | 5 Balken / 2 Balken                | Zeilenplatzhalter                            | ✔      |

### 2.5 Quellen lesen

| Was              | Original                                                                                                                                          | Nachbau vorher              | Maßnahme                             | Status |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------ | ------ |
| Darstellung      | H1 24/30 (350), H2 20/26 (380), H3 16/22 (470), Absatz 16/24 mit 8 unten, Listen Einzug 36, Tabellen 14/20, Links #4259ff / #c3cafc, Fett, Kursiv | ein `<p>` mit Umbrüchen     | `SourceText` mit Markdown            | ✔      |
| Zitat-Markierung | Reader springt zur Passage, Fläche #edeffa                                                                                                        | funktioniert im Klartext    | Markierung auch in formatiertem Text | ✔      |
| Zitat-Popup      | 420x420, Radius 8, Kopf 14/500 ohne Linie, Text wie Reader, Fuß mit Linie und Link                                                                | Text als Klartext           | `SourceText`, Maße wie Original      | ✔      |
| Parser           | Links, Fett, Kursiv, Tabellen bleiben erhalten                                                                                                    | gehen bei Web/DOCX verloren | `html-text.ts` schreibt Markdown     | ✔      |

### 2.6 Weitere Bereiche

| Bereich                    | Stand                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Status |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Startseite                 | Kopf mit Suche und ⚙, Karten 272x185 mit Emoji, Datum TT.MM.JJJJ und Quellenzahl, Pille „Neues Notizbuch“. Ohne Filter-Tabs, Raster/Liste-Umschalter, empfohlene Notebooks.                                                                                                                                                                                                                                                                               | ◐      |
| Dialoge                    | „Quellen hinzufügen“ 700 px, Radius 28, Bottom-Sheet auf dem Handy, Fokus auf dem Dialog. Suche im Web unter „Quellen hinzufügen“ (Tavily, nur Web). Ohne Drive, Bücher, Zähler „n/300“, Deep Research.                                                                                                                                                                                                                                                   | ◐      |
| Menüs                      | Panel Radius 20, Einträge 36 hoch, ohne Abstand unter dem Auslöser, Untermenü für die Darstellung. Quellen sortieren und Quelle umbenennen, Notizbuch kopieren, Startseite: Titel bearbeiten und anpinnen.                                                                                                                                                                                                                                                | ◐      |
| Studio-Liste und Ansichten | Notizen und Ausgaben in einer Liste, gemeinsamer Rahmen, ⋮-Menü, Schimmerzeile beim Erzeugen, leere Liste wie im Original. Notiz-Editor (Tiptap, Markdown) mit Format-Leiste, „Notiz hinzufügen“ als Pille und als Knopf in der Leiste, Prompt-Chip, „Guter/Schlechter Bericht“. Ohne Teilen.                                                                                                                                                             | ◐      |
| Chat                       | Zeitstempel, Fließtextfarbe, fette Begriffe, Aktionsleiste, Senden-Pfeil nach Eingabe, Eingabeleiste 628 px, Verläufe oben, Notebook-Übersicht (Emoji 40, Titel 36/44, „n Quellen · Datum“, Zusammenfassung, In Notiz speichern, Kopieren). Tagestrenner über dem ersten Eintrag eines Tages. „Nach unten springen“, „Notizbuch anpassen“ (Titelbild, Titel, eigene Zusammenfassung), „Vorgehen“ statt „Thoughts“ (echte Schritte, deutsch). Ohne Daumen. | ◐      |
| Dunkelmodus                | Tokens aus den Messungen, Tooltip invertiert, Quellenkarte #2f334b, Markierung #32343e; Screenshots verglichen.                                                                                                                                                                                                                                                                                                                                           | ✔      |
| Handy 390 px               | Tab-Leiste 12 px unter der Kopfzeile, Bottom-Sheets, Platzhalter wie Desktop. Titel bleibt sichtbar (Original blendet ihn aus Platzmangel aus).                                                                                                                                                                                                                                                                                                           | ◐      |
| Seite als Ganzes           | Schrift, Fokusring 3 px, Auswahlfarbe, Scrollbalken, `prefers-reduced-motion` (Schimmer steht still).                                                                                                                                                                                                                                                                                                                                                     | ✔      |

**Offen, nicht gebaut** (nicht ohne neuen Umfang möglich): Quelle umbenennen, Filter und Sammlungen
auf der Startseite.

## 3. Reihenfolge und Commits

Ein Thema pro Commit, Feature-Branch `feat/ui-fidelity-round-2`:

1. Zeiger und Tooltips.
2. Raster und Abstände (2.1) und Kopfzeile (2.2).
3. Ladezustände (2.4).
4. Quellen lesen (2.5) samt Parser.
5. Die Punkte aus 2.6, je Bereich ein Commit.

Nachweis je Commit: `pnpm check`, `pnpm test`, Browser-Vergleich hell und dunkel.

## 4. Bewusste Abweichungen (gibt es bei uns nicht oder mit Absicht anders)

- **Google-Kontext:** „Freigeben“, „PRO“, Apps-Raster, Empfohlene Notebooks, Drive-Import, Bücher.
- **Web-Recherche:** gebaut mit Tavily, nur „Web“ mit schneller Suche; ohne Drive (bräuchte Google-Anmeldung mit Dateizugriff) und ohne Deep Research (dauert Minuten, teuer). Die Google-Suche im Gemini-Tarif ist kostenlos nicht nutzbar (429).
- **Studio-Formate:** Audio, Präsentation, Video, Infografik, Datentabelle fehlen (laut Plan bewusst nicht).
- **Gedankenschritte „Thoughts“:** nicht die Gedanken des Modells (englisch, teuer, siehe [SPIKE-ERGEBNISSE.md](SPIKE-ERGEBNISSE.md), Abschnitt 5), sondern „Vorgehen“ mit den echten Schritten des Servers.
- **Gute/schlechte Antwort** (Daumen): kein Feedback-Speicher, kein Bedarf.
- **Name:** „NotebookLM (Nachbau)“ statt „Gemini Notebook“ (siehe ENTSCHEIDUNGEN.md).
