---
name: NotebookLM (Nachbau)
description: A neutral grey, three-panel workspace for sourced answers, measured on the original; color only where it carries meaning.
colors:
  background: '#faf9f9'
  foreground: '#000000'
  body: '#303030'
  doc: '#1b1b1c'
  meta: '#5e5e5e'
  card: '#ffffff'
  primary: '#000000'
  primary-foreground: '#ffffff'
  secondary: '#f2f0f0'
  muted-foreground: 'rgb(0 0 0 / 0.55)'
  accent-veil: 'rgb(0 0 0 / 0.08)'
  border: 'rgb(0 0 0 / 0.08)'
  input: '#c4c7c5'
  link: '#4259ff'
  selected: '#dcf1ff'
  highlight: '#edeffa'
  prominent: '#9dd2ff'
  destructive: '#b3261e'
  success: '#008052'
  warning: '#8c5000'
  studio-pink: '#c43d92'
  studio-warm: '#ff8104'
  studio-teal: '#167f9b'
  studio-purple: '#6858c7'
  studio-blue: '#2e64de'
  studio-green: '#0aac6e'
  action: '#5d5cf4'
  tooltip: '#303030'
typography:
  ui:
    fontFamily: 'Google Sans Flex Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 370
    lineHeight: '1.25rem'
  small:
    fontFamily: 'Google Sans Flex Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.8125rem'
    lineHeight: '1.0625rem'
  title:
    fontFamily: 'Google Sans Flex Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.9375rem'
    fontWeight: 470
  reading:
    fontFamily: 'Google Sans Flex Variable, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    lineHeight: '1.5rem'
rounded:
  sm: '8px'
  md: '12px'
  lg: '16px'
  xl: '20px'
  2xl: '24px'
  3xl: '28px'
  panel: '32px'
  bubble: '40px'
  tooltip: '4px'
spacing:
  gutter: '12px'
  gap: '8px'
  panel-padding: '8px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '9999px'
    height: '36px'
  button-prominent:
    backgroundColor: '{colors.prominent}'
    textColor: '{colors.doc}'
    rounded: '9999px'
  input:
    backgroundColor: 'transparent'
    textColor: '{colors.foreground}'
    rounded: '{rounded.2xl}'
    height: '44px'
  panel:
    backgroundColor: '{colors.card}'
    rounded: '{rounded.panel}'
    padding: '8px'
  question-bubble:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.body}'
    rounded: '{rounded.bubble}'
    padding: '20px 28px'
  tooltip:
    backgroundColor: '{colors.tooltip}'
    textColor: '#f2f2f2'
    rounded: '{rounded.tooltip}'
    padding: '4px 8px'
---

# Design System: NotebookLM (Nachbau)

The source of truth for every value is [apps/web/src/index.css](apps/web/src/index.css) (semantic
tokens, light in `:root`, dark in `.dark`). This file describes how to use them. The measured
comparison with the original is [docs/DESIGN-ABGLEICH.md](docs/DESIGN-ABGLEICH.md).

## Overview

**Creative North Star: "Faithful to the Original".** A quiet, neutral grey workspace in which the
sources and the cited answer are the content. Values were measured on the real product (computed
styles at 1440x900 and 390x844, light and dark), not guessed. Deviations from the original are
deliberate and listed in DESIGN-ABGLEICH.md, section 3. Color is rare and carries meaning: focus and
links, the selected state, the icons of the Studio formats, and one soft blue action. Anti-reference:
decorative gradients, colored cards, and raw palette colors in components.

## Colors

- **Neutral surfaces.** Page `#faf9f9` (dark `#0f0f0f`), panels and dialogs sit on it, fields and
  pills use `secondary` (`#f2f0f0`, dark `#171717`). Text is black on light and `#e6e6e6` on dark.
- **Strong action is neutral.** `primary` is black on light and light grey on dark. There is no brand
  accent color for buttons.
- **One color for links and focus.** `link` / `ring` is `#4259ff` (dark `#a1c9ff`).
- **State.** `selected` is a pale blue for a chosen card, `highlight` marks the cited passage in the
  reader (`#edeffa`, dark `#32343e`). Hover and focus are a veil of the text color (8 %), like Material 3 state
  layers.
- **The one soft blue action.** `prominent` (`#9dd2ff`, dark `#1f3b9b`) is used for "Neues Notizbuch" only.
- **Studio icons** carry the only decorative color: pink, warm orange, teal, purple, blue, green. Each
  format keeps its color. Flashcards sit on a dark stage in both themes; the mind map uses its own
  pastel nodes.
- **Rule.** Components use semantic tokens (`bg-card`, `text-muted-foreground`), never a raw palette
  color. Muted text is the text color at 55 % (about 6:1 on dark, about 4.7:1 on light).

## Typography

One family: Google Sans Flex (variable, OFL). The interface is set slightly narrow
(`font-stretch: 92 %`), reading text at the normal width (100 %).

- **UI** 15/20, label weight 370, titles weight 470. **Small** 13/17 for meta text, tooltips and counts.
- **Reading** 16/24 for chat answers and source text, with bold key terms. Overview title 36/44, weight 320.
- Variable weights between the usual steps are named (`font-label`, `font-title`); do not use 400/500/700 by habit.
- Sizes and weights are custom tokens; `tailwind-merge` knows them (see `lib/utils.ts`).

## Layout

Three columns on desktop (from 1056 px): Sources 25 %, Chat 48 %, Studio 25 % of a container that starts
12 px from the window edge, with 8 px between panels. Below that the three become tabs (Sources, Chat,
Studio), and dialogs become bottom sheets. The chat column reads at a maximum of 660 px; the prompt bar is 628 px
wide. No horizontal page scroll at 390 px.

## Elevation & Depth

Flat, with tonal layering: panels on the page, fields on panels. Depth is a soft glow
(`0 0 20px` at 4 % black, 28 % in dark) on floating surfaces such as the prompt bar and menus.
Chat top and Studio bottom fade out with a 28 px gradient to the page color.

## Shapes

Round and soft. Panels 32, question bubble 40, menus 20, fields 24, pills fully round, tooltips a
sharp 4. Radius names carry what they hold (`panel`, `bubble`). Do not invent intermediate radii.

## Components

- **Buttons** are pills; default height 36 px, icon buttons 36 to 40 px, as in the original. The strong one is neutral.
- **Tooltips** are the inverse of the page (dark on light, light on dark), 13/17, appear after 150 ms, 8 px
  below the element. Every icon button has one.
- **Loading** is a shimmer in the shape of the content to come (1.4 s, standing still under reduced
  motion), never a pulse. The layout stands first; placeholders sit in place.
- **Citation chips** are numbered, hover opens a popup 420x420 with the passage, click opens the reader.
- **States** every async view shows empty, loading, error (with retry) and pending (disabled, no double submit).

## Do's and Don'ts

- Do use shadcn primitives and semantic tokens; do copy a measured value from DESIGN-ABGLEICH.md.
- Do keep UI text German, in the informal "du", without technical terms.
- Don't add color to make a screen livelier; the neutral grey is the look.
- Don't use side stripes, gradient text or card-in-card nesting.
- Don't build a control that has no function ("no switch without a function").
- Known gaps: touch targets of 36 to 40 px (tabs 28 px) against the 44 px guideline, and a global
  0.01 ms transition kill under `prefers-reduced-motion`.
