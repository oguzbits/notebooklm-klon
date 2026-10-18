# Comparison with the original (Gemini Notebook, formerly NotebookLM)

This document records what the original does (measured) and what the re-creation has taken from it. The
columns "Clone before" and "Measure" show the way there; deviations are in section 3.
The raw data (measurements, screenshots) is local in `spikes/reference/` and not in the repo.

## 1. Rules of the comparison

- **Measure instead of estimate.** Every value comes from the computed styles of the original (window 1440x900,
  zoom 100 %, light and dark; phone 390x844). No value from memory.
- **Read only.** Nothing is created, deleted or changed in the original; network throttling and emulation are reset
  afterwards.
- **Evidence per area:** (1) numeric comparison of the computed styles original against clone, (2) screenshots
  side by side, light and dark, (3) a test where the behavior can be checked (jsdom does not measure geometry).
- **What does not exist in our version is not faked.** No switch without a function, no tile for a format we do
  not produce. The deviations are in section 3.
- **Texts stay German and informal ("Du")**, terms as in the original ("Quellen" sources, "Studio", "Notizen" notes, "Chat"), without
  technical terms (rule 10 in [AGENTS.md](../AGENTS.md)).

## 2. Comparison table

### 2.1 Grid and spacing (notebook page, from 1056 px)

| What                 | Original (measured)                                                                                                                | Clone before                                  | Measure                                                                                               | Status |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| Outer margin         | Container x=12, width window − 24; panels end 12 px above the window edge                                                          | left 12, right 12                             | Container with 12 px left, width `100vw − 24`                                                         | ✔      |
| Columns              | 25 % / 48 % / 25 % of the container plus two dividers of 8 px; the remaining 2 % (minus 16 px) stay free on the right              | 24.58 vw / rest / 24.58 vw, gap 8             | Columns by this rule (1440: 354 / 679.7 / 354, right margin 24)                                       | ✔      |
| Column width         | Two invisible dividers of 8 px (`col-resize`), only the two adjacent columns change, each at least 285 px; not stored, no keyboard | fixed widths                                  | Dividers with dragging and arrow keys (16 px), for the session only; operation and limits in the code | ✔      |
| Panel                | Radius 32, padding 8 + 1 px transparent border, bottom edge 12 px above the window edge                                            | padding 8 without border (338 instead of 336) | 1 px transparent border                                                                               | ✔      |
| Panel header sources | 336x40 at y=73, inner 8 8 8 12, title 15/20, toggle 20 px icon in a 48 px area                                                     | 338x40                                        | Width through the border; check the toggle                                                            | ✔      |
| Panel header Studio  | 336x**36** at y=73; tiles start at y=109                                                                                           | 40 high, tiles at 112                         | Header 36 high                                                                                        | ✔      |
| Studio, tile spacing | Grid gap 8; then 12 to the list                                                                                                    | 16                                            | 12                                                                                                    | ✔      |
| Source list          | Row 36 high, radius 8, inner 0 8, gap 12; row spacing 0                                                                            | 65 high (with "Übersicht" row)                | Overview only in the reader; row 36                                                                   | ✔      |
| Source header row    | "Alle auswählen" (select all) left of sort icon, right checkbox, 40 high, inner 4 8 4 4                                            | right-aligned "Alle Quellen auswählen"        | Row as in the original                                                                                | ✔      |
| Chat, side padding   | 8 (content) + 12 + 24 (pair) = 44 per side; text 5 px further; answer right 32 additional                                          | 40                                            | 44 (confirmed in the code: surface `px-5` + column `px-6`)                                            | ✔      |
| User bubble          | Surface `surface-dim`, radius 40, inner 20 28, text 14/24, left 32 spacing                                                         | text 16, other padding                        | as original                                                                                           | ✔      |
| Timestamp            | "Heute • 20:51" (today) 12/16, weight 500, spacing 0.096, centered, spacing 16 / 12                                                | missing                                       | add (time of the question)                                                                            | ✔      |
| Input bar            | Container 660 (inner 0 16) ⇒ input **628x64**, radius 32, shadow `0 0 20px`; hint text 13/17, inner 12 0                           | 660 wide                                      | 628 + hint text at the window edge (chat reaches down to 900)                                         | ✔      |
| Chat top / bottom    | 28 px gradient at the top (page color → transparent); Studio bottom 28 px gradient                                                 | no gradient                                   | both gradients                                                                                        | ✔      |

### 2.2 Header

| What     | Original                                                                                   | Clone before             | Measure                                                                                                       | Status |
| -------- | ------------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------- | ------ |
| Title    | Input 22/36, x=76 (logo 36 at x=20, gap 12, inner 8), editable                             | h1 20 px, not editable   | 22/36; rename through the field (if the endpoint exists)                                                      | ✔      |
| Right    | "+ Notebook erstellen" (text pill), Share, ⋮ configuration, ⚙, PRO, Apps, avatar 40; gap 8 | "Einstellungen" + avatar | "+ Notebook erstellen" (creates "Unbenanntes Notebook" at once), ⋮ (configure chat …), ⚙ (appearance), avatar | ◐      |
| Tooltips | "Weitere Optionen", "Einstellungen" …                                                      | none                     | through the new tooltip                                                                                       | ✔      |

### 2.3 Pointer, tooltips, focus

| What       | Original                                                                                                                                                | Clone before                                 | Measure                                                        | Status |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- | ------ |
| Pointer    | `pointer` on tiles, rows, icon buttons, pills                                                                                                           | `default` everywhere (Tailwind v4 preflight) | Base rule for active buttons, links, `role=button`             | ✔      |
| Tooltip    | Inverse surface (light #303030/#f2f2f2, dark #e3e3e3/#303030), 13/16, radius 4, inner 4 8, max 200, 0 ms, 8 px below the element, 150 ms in / 90 ms out | none                                         | `Tooltip` component; tiles, icon buttons, source/output titles | ✔      |
| Focus ring | 3 px, outside, follows the shape                                                                                                                        | same                                         | –                                                              | ✔      |

### 2.4 Loading states

| What          | Original                                                                                                                                | Clone before                  | Measure                             | Status |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------- | ------ |
| Kind          | Shimmer (gradient 90°, 25/37/63 %, 400 %, 1.4 s), no pulsing; shape like the later content                                              | `animate-pulse`, gray bars    | Shimmer component with tokens       | ✔      |
| Home page     | Card grid                                                                                                                               | 3 bars                        | 4 cards 272x185, radius 40          | ✔      |
| Notebook      | Layout stands at once; chat: spinner + 7 bars (deliberately without spinner in ours) (46 high, gap 8, 85–100 %); Studio: 5 rows 64 high | whole page replaced by 3 bars | Layout stays, placeholders in place | ✔      |
| Sign-in check | empty surface                                                                                                                           | 3 bars                        | empty surface, without spinner      | ✔      |
| Reader, popup | Spinner in the overview card; rows                                                                                                      | 5 bars / 2 bars               | Row placeholders                    | ✔      |

### 2.5 Reading sources

| What               | Original                                                                                                                                           | Clone before               | Measure                              | Status |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------ | ------ |
| Rendering          | H1 24/30 (350), H2 20/26 (380), H3 16/22 (470), paragraph 16/24 with 8 below, lists indent 36, tables 14/20, links #4259ff / #c3cafc, bold, italic | one `<p>` with line breaks | `SourceText` with Markdown           | ✔      |
| Citation highlight | Reader jumps to the passage, surface #edeffa                                                                                                       | works in plain text        | Highlight also in formatted text     | ✔      |
| Citation popup     | 420x420, radius 8, header 14/500 without line, text like reader, footer with line and link                                                         | text as plain text         | `SourceText`, dimensions as original | ✔      |
| Parser             | Links, bold, italic, tables are kept                                                                                                               | lost for web/DOCX          | `html-text.ts` writes Markdown       | ✔      |

### 2.6 Further areas

As of 2026-10-01, dimensions checked against the original in the browser (columns at 1720 px, chat padding 53 px per side, cards 272x185, phone 390 px). ◐ here means: the look matches, single functions are deliberately missing (section 3). ✔ means: nothing is missing.

| Area                  | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Status |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Home page             | Header with search and ⚙, cards 272x185 with emoji, date DD.MM.YYYY and source count, pill "Neues Notebook" (creates "Unbenanntes Notebook" at once). Without filter tabs, grid/list switch, recommended notebooks.                                                                                                                                                                                                                                                                                                                                                              | ◐      |
| Dialogs               | "Quellen hinzufügen" (add sources) 700 px, radius 28, bottom sheet on the phone, focus on the dialog. Web search under "Quellen hinzufügen" (Tavily, web only). Without Drive, books, counter "n/300", Deep Research.                                                                                                                                                                                                                                                                                                                                                            | ◐      |
| Menus                 | Panel radius 20, entries 36 high, no gap below the trigger, the appearance setting is directly in the menu (no submenu that sticks out of the window on the phone). Sort sources and rename source, copy notebook, home page: edit title and pin.                                                                                                                                                                                                                                                                                                                                | ◐      |
| Studio list and views | Notes and outputs in one list, shared frame, ⋮ menu, shimmer row while generating, empty list as in the original. Note editor (Tiptap, Markdown) with format bar, "Notiz hinzufügen" (add note) as a pill and as a button in the bar, prompt chip, "Guter/Schlechter Bericht" (good/bad report). Without sharing.                                                                                                                                                                                                                                                                | ◐      |
| Chat                  | Timestamp, body text color, bold terms, action bar, send arrow after input, input bar 628 px, gradients at the top, notebook overview (emoji 40, title 36/44, "n Quellen · date", summary, save to note, copy). Day divider above the first entry of a day. "Nach unten springen" (jump down), "Notebook anpassen" (cover image, title, own summary), hover on the title block (without an image the area fills and a landscape fades in, with an image a light veil; 24 px beyond the text), "Vorgehen" (procedure) instead of "Thoughts" (real steps, German). Without thumbs. | ◐      |
| Dark mode             | Tokens from the measurements, tooltip inverted, source card #2f334b, highlight #32343e; screenshots compared.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ✔      |
| Phone 390 px          | Tab bar 12 px below the header, bottom sheets, placeholders like desktop. Title stays visible (the original hides it for lack of space). Screenshots 390x844 compared: tab bar, input bar and hint text are in the same place; the header lacks Share, PRO and Apps (section 3).                                                                                                                                                                                                                                                                                                 | ✔      |
| Page as a whole       | Font, focus ring 3 px, selection color, scrollbars, `prefers-reduced-motion` (shimmer stands still).                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | ✔      |

**Font (2026-10-01):** Width, weights and button spacing are measured against the width of the same text in the original and
matched.
Not measured: document text of the source view, icon stroke weight.

**Comparison with rea (2026-10-14):** The images of the original were compared with `rea compare-web-screenshots` against the images of the clone
(offline server), 8 views each before and after. Matched were:

- Card title to one line with ellipsis.
- Citation popup left at the chip, 11 px in front.
- "Chat konfigurieren" (configure chat) 864 px wide.
- A page for unknown addresses.

The pixel values moved by at most 0.3 percentage points, partly in the wrong direction. The timing of the
capture alone (in the middle of the light/dark switch) shifted one value by 5 points. The values are driven by differences that
remain: different answer texts, section 3. Conclusion: overall pixel values are not suitable as a measure for the comparison. Evidence remains
measured dimensions in the browser and images side by side (section 1). Open: whether the original collapses the source overview after a
citation click.

**Open, not built** (not possible without new scope): filters and collections on the home page,
output language as an account setting, "Alle Notizen als Quelle festlegen" (set all notes as source).

## 3. Deliberate deviations (not present in ours, or deliberately different)

- **Google context:** "Freigeben" (share), "PRO", apps grid, recommended notebooks, Drive import, books.
- **Web research:** built with Tavily, only "Web" with fast search; without Drive (would need a Google sign-in with file access) and without Deep Research (takes minutes, expensive). Google search in the Gemini plan is not usable for free (429).
- **Studio formats:** audio, presentation, video, infographic are missing (deliberately not, per the plan). The data table is built.
- **Thought steps "Thoughts":** not the model's thoughts (English, expensive, see [SPIKE-RESULTS.md](SPIKE-RESULTS.md), section 5), but "Vorgehen" (procedure) with the real steps of the server.
- **Good/bad answer** (thumbs): no feedback store, no need.
- **Name:** "NotebookLM (Nachbau)" (re-creation) instead of "Gemini Notebook".
- **Studio dialogs, fine points:** row "Fragetypen" (question types) with "Neu!" and chips, language choice, usage display and "Später generieren" (generate later) are missing. On the phone our bars wrap, the original cuts them off at 390 px at most.
