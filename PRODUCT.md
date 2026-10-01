# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the reviewers of a job application (Everlast AI, second round). They open the live demo
for a few minutes, try the example notebook, then read the repo and watch a short walkthrough video. They judge
whether the author masters a full-stack engineer's stack (React, Node.js, PostgreSQL, API design, LLM
integration) and cares about verifiable answers, not only about a demo that looks good.

Secondary: anyone who wants to ask questions of their own documents and check every claim at its
source. The UI is German only; sources and questions may be English.

## Product Purpose

A clone of NotebookLM (now "Gemini Notebook"): a notebook of the user's own sources (PDF, DOCX, TXT/MD,
web pages, web search results), a chat that answers only from the selected sources, and a Studio that
turns them into reports, flashcards, quizzes and mind maps. Success means a reviewer can reach a
cited answer in under a minute and can follow any citation back to the exact passage.

## Positioning

The core is the citation contract: every statement of an answer carries numbered chips that point to
real passages sent to the model; the server strips or rejects citations that were not in the context. The same
contract covers Studio outputs. The interface follows the original closely (measured values, see
[docs/DESIGN-ABGLEICH.md](docs/DESIGN-ABGLEICH.md)), so the evaluation is about engineering and
verifiability, not about a new look.

## Operating Context

- Deployment and walkthrough: a live demo with a guest account ("Beispiel ausprobieren") that holds a
  copy of an example notebook, a GitHub repo, and a video of at most ten minutes.
- Free-tier operation: Gemini free tier, a separate Google project for the demo, per-user quotas and
  rate limits, daily caps on web search (Tavily).
- Optional features depend on configuration: web search needs a Tavily key, cover images need an
  S3-compatible store. The UI hides what the installation does not have.
- Stack, layers and invariants: [AGENTS.md](AGENTS.md), [docs/PLAN.md](docs/PLAN.md),
  decisions in [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).

## Capabilities and Constraints

- Built: sign-in and guest access, notebooks (copy, pin, rename, custom summary, cover image),
  sources with status and idempotent ingestion, streaming chat with citations, source guide per source,
  notes with an editor, Studio (report, flashcards, quiz, mind map), chat configuration, web search for
  sources, the "Vorgehen" trace of an answer.
- Deliberately not built: audio and video overview, presentation, infographic, data table, Deep
  Research, Drive import, sharing and collaboration, answer ratings (thumbs), PPTX as source.
- UI language is German, free of technical terms (no "RAG", "Embedding", "Chunk" for users). Terms follow
  the original: "Quellen", "Studio", "Notizen", "Chat".
- Undecided: the Hetzner deployment files (they need the object store service and a volume).

## Brand Commitments

The name "NotebookLM (Nachbau)" with a visible note that it is a replica for a job application, not by Google and
not connected to Google. Using the original's logo and name was explicitly allowed by the author.

## Evidence on Hand

- Spike results on retrieval, models and limits: [docs/SPIKE-ERGEBNISSE.md](docs/SPIKE-ERGEBNISSE.md).
- An example notebook ("Beispiel: Projekt Nordlicht") seeded by `pnpm seed:demo`.
- No customers, testimonials or usage numbers exist. Do not invent any. The Loom link is not recorded yet.

## Product Principles

1. Verifiable beats impressive: an answer without a checkable source is worse than no answer.
2. Few features at high quality; what is not built is stated, not faked (no switch without a function).
3. Measure the original, never guess; deviations are deliberate and written down.
4. Every async view has empty, loading, error and pending states.
5. Authorization and scoping live on the server, in SQL, never in the client.

## Accessibility & Inclusion

Keyboard operation and visible focus (3 px ring) are required; every control has a German label. Reduced
motion is respected. Light and dark themes both meet contrast AA for text. Touch targets follow the
original (36 to 40 px), a known gap against 44 px.
