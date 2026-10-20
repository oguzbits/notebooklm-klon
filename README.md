# NotebookLM Clone

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4-orange?logo=hono)](https://hono.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pgvector-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Node](https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

A notebook that answers only from your own sources and backs every statement with a number. Clicking the number opens the source text at the cited passage.

A re-build of NotebookLM. The focus is the path from source to verifiable citation: ingestion, search, answer with checked citations, evaluation. The UI is German or English (switch in the settings menu); sources and questions may be either.

|             |                                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live demo   | https://128-140-11-37.sslip.io                                                                                                                                             |
| Demo access | On the sign-in page, **„Demo ausprobieren“** (try the demo): a guest account with its own copy of the demo notebook, no email and no password. It is deleted after 7 days. |

## What it can do

- **Notebooks and sources:** PDF, DOCX, PPTX, images, recordings (MP3, WAV), public YouTube videos (spoken word), TXT, MD and web pages by link, with status in the background. The selection of sources also limits the search. Web search through Tavily is optional.
- **Chat** with streaming: every statement carries numbered chips, hover shows the passage, a click opens the source text with the passage highlighted. The history is kept per notebook and feeds into follow-up questions.
- **Overviews** per source and per notebook with suggested questions.
- **Notes** from answers (citations are kept) and own notes with an editor, optionally as a source.
- **Studio:** report (briefing, FAQ, study guide, blog post, custom instruction), flashcards, quiz, mind map and data table, with the same checked citations.
- **Customize a notebook:** title, summary, cover image, copy, pin.

Not built: audio and video overview, presentation and infographic in the Studio (audio and video exist only as a source), agentic search, Deep Research, Drive integration, rating of answers. Reasons: [docs/PLAN.md](docs/PLAN.md).

## Tech stack

**Frontend:** [React 19](https://react.dev/), [Vite](https://vite.dev/), [TanStack Query](https://tanstack.com/query), [Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)

**Backend:** [Hono](https://hono.dev/) (API and RPC types for the web), [Drizzle ORM](https://orm.drizzle.team/), [pg-boss](https://github.com/timgit/pg-boss) (job queue in Postgres), [Better Auth](https://www.better-auth.com/) (sessions)

**Data and AI:** PostgreSQL with pgvector and full-text search, S3-compatible object store (SeaweedFS), Gemini API (PDF reading, embeddings, answers), Tavily (optional web search)

**Contracts and quality:** [Zod](https://zod.dev/) in `packages/shared`, Vitest, MSW, Playwright, ESLint, dependency-cruiser, knip

Why this stack: [docs/PLAN.md](docs/PLAN.md).

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    Web["React 19<br/>TanStack Query, shadcn"]
  end
  subgraph Server["Hetzner server (Docker Compose)"]
    Caddy["Caddy<br/>HTTPS"]
    subgraph Container["App container"]
      Api["Hono API<br/>Zod schemas from packages/shared"]
      Worker["Ingestion worker<br/>pg-boss"]
    end
    DB[("PostgreSQL with pgvector<br/>full-text search, sessions,<br/>job queue")]
    S3[("SeaweedFS (S3-compatible)<br/>cover images (optional)")]
  end
  Gemini["Gemini API<br/>read PDF, embeddings, answer"]
  Tavily["Tavily<br/>web search (optional)"]

  Web -- "HTTPS" --> Caddy
  Caddy -- "HTTP + SSE, one origin" --> Api
  Api --> DB
  Api -- "stream answer" --> Gemini
  Api -- "search terms only" --> Tavily
  Api --> S3
  Worker --> DB
  Worker -- "read PDF, embed" --> Gemini
```

The frontend is served by the same process as the API (`WEB_DIST_DIR`); in development Vite forwards `/api`. Locally, Postgres and the object store run from `pnpm db:up`.

### Layers

The rules are in [AGENTS.md](AGENTS.md) and enforced by `pnpm check` (dependency-cruiser, ESLint, knip, jscpd).

- `packages/shared`: only Zod schemas, derived types and `as const` dictionaries. Single source of truth for every contract between API and web, including the citation schema.
- `apps/api/src/core`: pure logic without I/O (chunking, citation check, context building, SSRF rules). Routes are thin adapters; database, jobs and providers sit behind them.
- `apps/web`: React, server state only through TanStack Query. The web code imports only the `AppType` type from the API, for the Hono RPC client.

### Project structure

```
.
├── apps/
│   ├── api/src/
│   │   ├── core/        # pure logic: chunking, citation check, context, SSRF rules
│   │   ├── routes/      # thin Hono adapters
│   │   ├── ingestion/   # worker: parse, chunk, embed
│   │   ├── search/      # hybrid search (vector + full text)
│   │   ├── ai/          # Gemini adapters
│   │   ├── db/          # Drizzle schema, migrations, queries
│   │   └── config/      # env and limits (the only place for model IDs)
│   └── web/src/         # React app: components, hooks, lib
├── packages/shared/     # Zod schemas, types, dictionaries (SSOT)
├── docs/                # plan, spike results, deployment, runbook, backlog
├── deploy/ docker/      # Compose, Caddy, Dockerfile pieces
└── scripts/             # audits, doc generation, usage report
```

### Ingesting a source

```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant Q as Job queue
  participant W as Worker
  participant G as Gemini
  participant D as PostgreSQL
  U->>A: file or link
  A->>A: check type and size, SHA-256 of the content
  alt content already present
    A-->>U: reuse the existing source
  else new content
    A->>Q: create job
    A-->>U: 202, status "Wartet" (waiting)
    Q->>W: job
    W->>G: read PDF (images, tables)
    W->>W: canonical text, passages with offsets
    W->>G: embeddings in batches
    W->>D: text, passages, vectors in one transaction
    U->>A: poll status
    A-->>U: "Bereit" (ready)
  end
```

### Answer with checked citations

```mermaid
sequenceDiagram
  participant U as User
  participant A as API
  participant D as PostgreSQL
  participant G as Gemini
  U->>A: question
  A->>G: embed question
  A->>D: hybrid search (vector + full text, RRF) by user, notebook, selected sources
  D-->>A: 8 passages
  A->>G: passages as c1 to c8 and question, structured output
  loop per statement, as soon as it is complete
    G-->>A: statement with labels
    A->>A: map labels to real IDs, drop ones not shown
    A-->>U: statement with chunk IDs (SSE)
  end
  A->>D: store question and answer
```

The model sees only short labels per request. The server maps them to real passage IDs and removes every statement without a valid citation. A citation to something the model was never shown is therefore impossible. A valid citation is still no proof of a correct answer; that is why both are measured separately (see the evaluation).

## What I decided and why

Decisions with numbers: [Spike results](docs/SPIKE-RESULTS.md) (PDF parsing, embeddings, chat, citation format, hybrid search), [Plan](docs/PLAN.md) (requirements, stack, risks).

## Quality assurance

- `pnpm check`: TypeScript strict, ESLint, architecture rules, dead dependencies, duplicates (under 2 %), magic-string audit.
- `pnpm test`: Vitest without network. MSW rejects every unmocked request, so no test can use up quota.
- `pnpm test:db`: tests against Postgres with pgvector (`pnpm db:up`), including all access rules: every query filters by user, notebook and selected sources.
- `pnpm e2e`: Playwright user journeys against the offline server (real app and database, fake models).
- `pnpm eval:live`: 34 golden questions against the real models (hit rate, facts, dropped statements; plus three questions with no answer in the source for the refusal, a source text with an embedded instruction, and purely computed anomalies such as repeated statements). Uses quota, runs by hand and not in CI.
- `pnpm report:usage [--days 7]`: what the model calls consume, per purpose (average tokens per call) and per user. Reads only the `usage_events` table, costs nothing.
- CI (GitHub Actions): quality, unit tests, database tests, browser test, build, Semgrep.

Further rules that are checked in code: SSRF protection for link import (only http and https, DNS resolution, no private addresses, again after every redirect), size and page limits, rate limiting of all model calls, limits for guests, no document content in logs.

## Run locally

Requirements: Node 24, pnpm, Docker.

```bash
pnpm install
pnpm db:up                        # Postgres with pgvector on port 54329
cp .env.example .env.local        # fill in the values, see below
pnpm dev                          # API on :3000 and web on :5173 together, web forwards /api to the API
```

They can also run separately: `pnpm --filter @nlm/api dev` and `pnpm --filter @nlm/web dev`.

`.env.local` (template: [.env.example](.env.example)) needs: `GEMINI_API_KEY`, the three model IDs `AI_MODEL`, `PARSE_MODEL`, `EMBEDDING_MODEL`, `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL` (`http://localhost:5173`). Model IDs never appear in code; switching is an environment variable. `PARSE_FALLBACK_MODEL` is optional: a larger model for PDFs that `PARSE_MODEL` rejects as reproduction of protected text (`RECITATION`). The models chosen in the spike are listed in [docs/SPIKE-RESULTS.md](docs/SPIKE-RESULTS.md).

Without an API key you can use the offline server: the real app and database, but a model that cites the first sentence of the best passages (PDFs cannot be read there).

```bash
DATABASE_URL=postgresql://nlm:nlm@localhost:54329/nlm_e2e \
BETTER_AUTH_SECRET=local-only-for-trying-out-0123456789 \
BETTER_AUTH_URL=http://localhost:5173 \
pnpm --filter @nlm/api dev:offline   # plus in a second terminal: pnpm --filter @nlm/web dev
```

Web search (optional): set `TAVILY_API_KEY`. Without a key the UI does not show the search field.

Cover images (optional): an S3-compatible store; set `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` (all four or none). Locally `pnpm db:up` starts one (SeaweedFS) that keeps the images in memory only.

Create the demo notebook (needs the key, ingests three sample documents once): set `SEED_DEMO_EMAIL` and `SEED_DEMO_PASSWORD`, then run `pnpm seed:demo`. The command can be repeated. Guests („Demo ausprobieren“) get a copy of this notebook; for that, `SEED_DEMO_EMAIL` must also be set in the app's environment.

## Deployment

Hetzner Cloud with Docker Compose and Caddy (automatic HTTPS). [deploy.yml](.github/workflows/deploy.yml) builds the image and starts the stack over SSH as soon as CI on `main` is green. Setup, operation, backup and troubleshooting: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Where it would break first

- **Provider cost.** There is deliberately no per-user limit. Cost is limited by: content hash instead of duplicate processing, page limit per source, rate limiter with token weights, limits for guests, prefilled demo notebook. Whoever puts the site openly on the internet pays for every question and every source of the users.
- **Search when the question is in a different language than the source.** The text side of the hybrid search yields only noise there, and the weight 0.5 is not backed by measurement (see the addendum in the spike results). Re-evaluate with more golden questions.
- **PDF parsing by a language model** is not deterministic and can omit image captions. The model rejects some PDFs (measured: the NIST document in the load test) as reproduction of protected text (`RECITATION`), and the larger fallback model does not always accept them either; the source then reports an error. A comparison with a local parser would be the next step.
- **Multiple instances.** The rate limiters live in the memory of one process. With more than one instance they would have to move into the database.

## Agentic workflow

[AGENTS.md](AGENTS.md) (rules, layers, invariants, Definition of Done), hooks under `.claude/` (blocked commands, secret protection, gate before finishing), Husky hooks and one topic per commit. Tests belong to the change and are written first where the contract is clear (convention, not a gate).
