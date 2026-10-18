# NotebookLM Clone: Requirements, Stack and Risks

Sep 29, 2026 · @Oguz Öztürk · Context and frame. State and open points are in the code, in [BACKLOG.md](BACKLOG.md) and in the git history, not here.

## Goal and frame

The goal is a NotebookLM clone of production-ready quality, handed in with two artifacts: a GitHub repo and a live deployment.

- **Task:** Implementation, scope and structure are free; the use of AI tools is explicitly welcome.
- **Proof goal:** You master the stack of a full-stack engineer (React, Node.js, PostgreSQL, API design, LLM integration).
- **Focus:** AI core (RAG, verifiable citations, evals) and a visible agentic workflow in the repo. Breadth only as far as needed.
- **Time:** 4 to 5 full working days, the deadline is one week. The aim is to finish early and keep the rest as a buffer.
- **Cost:** minimal. Operation uses the paid Gemini plan with a small credit, limited by per-user limits and a daily brake
  (see [Quota and cost](#quota-and-cost)).
- **Language:** UI in German or English (cookie, then browser language, then German). Sources and questions may be either.

## What makes NotebookLM

The core is a chat that answers only from your own sources and backs every statement with a numbered citation that leads straight to the passage. Everything else hangs on that: create a notebook, add sources, chat, generate Studio outputs.

**What your screenshot shows (Gemini Notebook, German UI):**

- Citations are **numbered chips in the running text**, several per statement are possible. The numbers apparently stand for individual passages of the source (inferred from the image).
- **Hover** opens a popup with the file name, the cited passage text (scrollable) and the link "Quelle anzeigen" (show source).
- At the same time the **left panel shows the extracted source text** with the passage highlighted. It is not a PDF viewer and there are no page overlays.
- The highlight covers **whole paragraph blocks**, not single sentences. The granularity is the chunk.
- Also: source overview at the top of the source panel, counter "1 Quelle" (1 source) in the input field, notes, hint "kann Fehler machen" (can make mistakes).
- **Studio:** audio, presentation, video, mind map, reports, flashcards, quiz, infographic.

**Language:** NotebookLM has the setting "Output Language" for chat and generated content, the default is the language of the Google account. Sources stay in their original language. According to a third-party source it answers, without this setting, in the language of the last message.

**Consequence for the clone:** Citations are chunk-exact and are highlighted in the extracted text. We need neither bounding boxes nor a PDF viewer. How NotebookLM works internally is not documented (only secondary sources).

## Requirements

A few features in high quality beat many half-finished ones. The core is the path from source to verifiable citation.

**Must**

1. Sign-in and create, list and delete notebooks.
2. Add sources: PDF, DOCX, PPTX, images, recordings (MP3, WAV), public YouTube videos, TXT/MD and URL. Processing runs asynchronously with status and understandable error messages.
3. Chat with streaming that answers only from the selected sources, with numbered citations. Hover shows the popup, a click opens the source text with chunk highlighting.
4. Select and deselect sources. The selection also limits retrieval.
5. Source overview per source (summary and key topics).
6. Live deployment, README and a demo access with a prefilled demo notebook.

**Should**

- Suggested questions when a source is added.
- Save notes from answers.

**Re-creation.** The UI follows NotebookLM as exactly as possible, three columns
(sources | chat | Studio), with Google Sans Flex (OFL) and the colors, radii and
spacing measured on the original (neutral gray, blue only as an accent), light and dark.
Logo and name are explicitly allowed (decision of the user); the live demo carries a notice that it is
a re-creation. In addition:

- **Studio column:** report (briefing, FAQ, study guide), flashcards, quiz, mind map, data table. All outputs
  are structured, rely on the selected sources and follow the citation contract: every
  section, every card, every question, every cell of the data table and every branch points to real passages, and the server drops what is
  not backed. Notes live in the Studio column, as in NotebookLM.
- **Chat settings per notebook:** style (default, learning companion, custom instruction), answer length,
  output language (default: language of the question).
- **Small NotebookLM features:** paste text as a source, turn a note into a source, copy an answer.
- **Models:** All model IDs come from the environment (`AI_MODEL`, `PARSE_MODEL`, `EMBEDDING_MODEL`). Chat, Studio and overviews
  use the same `AI_MODEL`; there is no separate Studio model.

**Stretch**

- PPTX, recordings (MP3, WAV) and YouTube as a source.
- Web search in the chat (Tavily, optional, without Deep Research) and guest access with a copy of the demo notebook.

**Deliberately not**

- Audio and video overview, infographic, presentation, Deep Research.
- Sharing and collaboration, Drive integration. An own mobile app is out; the site itself has a mobile layout (tabs).
- Storing original files (only extracted text plus metadata).

**Quality requirements (production-ready)**

- SSRF protection for URL import, upload limits (size, page count, unpacked size) and rate limiting towards the provider, plus per-user limits and a daily brake
  (see [Quota and cost](#quota-and-cost)).
- Env validation with Zod, health check, structured logs, migrations with drizzle-kit.
- Tests: Vitest, Playwright user journeys, an eval script with golden questions. Tests run without real API calls (fixtures and mocks) so they do not use up the daily quota.
- CI with typecheck, lint and tests, plus an AGENTS.md that makes your agentic workflow visible in the repo.

## Architecture and data flow

Ingestion writes chunks and vectors to Postgres, the chat reads only the matching chunks of the selected sources, the Studio loads the selected sources in full.

## Tech stack v3

React frontend and Node.js backend in a monorepo, one container, Postgres with pgvector, Gemini. Docling and a second service are dropped. Prices and benchmarks come partly from third-party sources and must be checked before a decision.

| Area             | Choice                                                                                                                    | Reason / alternative                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Runtime, language | Node.js LTS, pnpm workspaces, TypeScript strict, Zod in `packages/shared`                                                | The requirements name Node.js and JavaScript. Bun deliberately not                                                         |
| Frontend         | React 19, Vite, React Router, TanStack Query, Tailwind, shadcn/ui, react-markdown                                         | The posting names React. A separate frontend visibly shows API design                                                      |
| Backend          | Hono with `@hono/zod-openapi`, SSE streaming, also serves the frontend                                                    | Typed RPC client and OpenAPI from Zod schemas. Fastify, Express or NestJS would be equivalent, Hono is replaceable        |
| Auth             | Better Auth with Drizzle adapter                                                                                          | Users in the own Postgres. Supabase Auth brings no RLS advantage with a direct DB connection. Row-level security of the own Postgres: see below |
| Database         | PostgreSQL with pgvector (HNSW), Postgres full-text search, Drizzle ORM; in production a container on the Hetzner server | One database for everything; Neon and Render Postgres rejected (they sleep on the free plan or expire after 30 days)      |
| Jobs             | pg-boss                                                                                                                   | Established Postgres queue instead of a home-grown one. Needs a direct connection, no PgBouncer                            |
| Parsing          | PDF: Gemini 3.1 Flash-Lite ([spike](SPIKE-RESULTS.md)). DOCX: mammoth. PPTX: fflate + XML (slide text, tables, notes). Audio: Gemini transcribes verbatim (inline, up to 10 MB). TXT/MD direct. URL: Readability. DOCX and URL are stored as Markdown (links, bold, tables), TXT stays plain text. On a recitation block: a second Gemini model (`PARSE_FALLBACK_MODEL`) | ParseBench (tables / content fidelity): Gemini 3.1 Flash-Lite 85.5 / 89.5, Docling 66.4 / 66.9, LiteParse 42.4 / 70.0 |
| Embeddings       | Gemini Embedding 2 with 768 dimensions (`EMBEDDING_MODEL`)                                                                | Limits known (RPM 100, TPM 30K, RPD 1000), on par with 001 in the spike (17 versus 16 of 18). The vector spaces of the two models are incompatible |
| Retrieval        | pgvector plus full-text search, fusion by RRF in SQL                                                                      | Hybrid catches proper names and numbers that vector search misses (in the spike one miss that led to a wrong answer)       |
| LLM layer        | Own slim Gemini client instead of Vercel AI SDK, model IDs and limits in the config                                       | Chat, Studio and overviews: the same model (`AI_MODEL`), chosen in the [spike](SPIKE-RESULTS.md)                           |
| Citations        | Structured output with chunk numbers, the server checks that the cited chunks were in the context                         | Anthropic Citations rejected (cost, provider lock-in)                                                                      |
| Tests, quality   | Vitest, Playwright user journeys, eval script, ESLint, Prettier, GitHub Actions                                           | Tests without real API calls                                                                                               |
| Hosting          | Hetzner Cloud: Docker Compose with Caddy, app, Postgres and SeaweedFS, deployment by GitHub Actions ([DEPLOYMENT.md](DEPLOYMENT.md)) | Runs permanently, no cold start. Render and Vercel rejected                                                                |

**Delimitation from notar-agent:** Zod, Drizzle, pgvector and the hybrid retrieval with RRF are adopted. New or changed are auth, queue (pg-boss instead of home-grown), parsing (Gemini instead of liteparse plus mammoth for everything) and dropping Supabase.

**Setup from notar-agent (adopted and adapted):** Rules and layers are in [AGENTS.md](../AGENTS.md), the gates in `package.json` (`pnpm check`, `pnpm test`) and in CI (`.github/workflows`), the hook rules in `.claude/settings.json` and `.claude/hooks`. Only what differs from notar-agent is listed here:

- **Gate `check`:** without a health score. It ran the individual tools a second time and let crashes pass as 100 points; the individual tools are already hard gates.
- **TypeScript:** 6.0, because typescript-eslint does not yet support TypeScript 7.
- **New:** env validation with Zod (`apps/api/src/config/env.ts`), network latch in tests (MSW rejects every unmocked request), tests for the hook scripts themselves, docs audit (`pnpm audit:docs`).
- **Skills and MCP:** chrome-devtools runs as an MCP server at user level, not in the repo. `software-craftsmanship` and `context7` are dropped because `AGENTS.md`, ESLint and the audits enforce the same rules.
- **Eval:** The idea is adopted, not a line of code. Dataset schema with text anchors instead of chunk IDs, pure scorers, recorded model answers replayed offline; Promptfoo, the Jev judge and a mock model from the ground truth are dropped because they only checked the wiring, not the quality. State and baseline: [Operations and quality tools](#operations-and-quality-tools).

**Not adopted:** Supabase repositories (authorization lives in the API, Postgres RLS is the second layer), Next.js route handlers, audit trail with hash chain, knowledge base of legal norms, PII logging scan (§ 203 StGB), Supabase N+1 scan, health score, promptfoo and the fixture generators for notary scans.

## Quota and cost

**What applies today** (the source is the code, the tables below are written by `pnpm docs:generate` from [config/limits.ts](../apps/api/src/config/limits.ts)
and [config/env.ts](../apps/api/src/config/env.ts); do not change by hand). The provider values are those of the paid plan
from the AI Studio dashboard. ❓ Whether billing is linked and a budget limit is set is nowhere in the repo.

Own limits (`LIMITS`):

<!-- generated:limits -->
| Limit | Value |
| --- | --- |
| `NOTEBOOKS_PER_USER` | 100 |
| `SOURCES_PER_NOTEBOOK` | 50 |
| `URL_IMPORT_MAX_REDIRECTS` | 5 |
| `URL_IMPORT_TIMEOUT_MS` | 15,000 |
| `URL_IMPORT_MAX_BYTES` | 5,242,880 |
| `UPLOAD_MAX_BYTES` | 10,485,760 |
| `UPLOAD_MAX_PDF_PAGES` | 50 |
| `UPLOAD_MAX_UNPACKED_BYTES` | 104,857,600 |
| `SOURCE_TITLE_MAX_CHARS` | 200 |
| `CHAT_CONTEXT_CHUNKS` | 12 |
| `CHAT_HISTORY_TURNS` | 3 |
| `CHAT_HISTORY_ANSWER_CHARS` | 600 |
| `PARSE_TIMEOUT_MS` | 120,000 |
| `AUDIO_PARSE_TIMEOUT_MS` | 300,000 |
| `VIDEO_ESTIMATED_TOKENS` | 90,000 |
| `CHAT_TIMEOUT_MS` | 120,000 |
| `EMBED_TIMEOUT_MS` | 60,000 |
| `RETRY_MAX_WAIT_MS` | 30,000 |
| `STUDIO_MAX_CHARS` | 120,000 |
| `USAGE_RETENTION_DAYS` | 30 |
| `USAGE_WINDOW_MS` | 86,400,000 |
| `CHAT_QUESTIONS_PER_WINDOW` | 40 |
| `STUDIO_OUTPUTS_PER_WINDOW` | 10 |
| `DAILY_TOKEN_BUDGET` | 2,000,000 |
| `GUESTS_PER_HOUR` | 20 |
| `GUESTS_PER_IP_PER_HOUR` | 3 |
| `GUESTS_ALIVE` | 200 |
| `GUEST_LIFETIME_DAYS` | 7 |
| `WEB_SEARCH_TIMEOUT_MS` | 10,000 |
| `EMBED_BATCH_SIZE` | 16 |
| `STALLED_JOB_AFTER_MS` | 900,000 |
| `INTERRUPTED_JOB_AFTER_MS` | 3,600,000 |
| `SHUTDOWN_SERVER_WAIT_MS` | 10,000 |
| `SHUTDOWN_JOB_WAIT_MS` | 60,000 |
<!-- /generated -->

Provider limits per model role (`PROVIDER_LIMITS`):

<!-- generated:provider-limits -->
| Role | Requests per minute | Tokens per minute |
| --- | --- | --- |
| PARSE | 1,000 | 2,000,000 |
| CHAT | 1,000 | 2,000,000 |
| EMBED | 3,000 | 1,000,000 |
<!-- /generated -->

Environment variables (`EnvSchema`):

<!-- generated:env -->
| Variable | Kind |
| --- | --- |
| `DATABASE_URL` | required |
| `DATABASE_OWNER_URL` | optional |
| `NODE_ENV` | default value |
| `PORT` | default value |
| `GEMINI_API_KEY` | required |
| `AI_MODEL` | required |
| `PARSE_MODEL` | required |
| `PARSE_FALLBACK_MODEL` | optional |
| `EMBEDDING_MODEL` | required |
| `BETTER_AUTH_SECRET` | required |
| `BETTER_AUTH_URL` | required |
| `TAVILY_API_KEY` | optional |
| `S3_ENDPOINT` | optional |
| `S3_REGION` | optional |
| `S3_BUCKET` | optional |
| `S3_ACCESS_KEY_ID` | optional |
| `S3_SECRET_ACCESS_KEY` | optional |
| `SENTRY_DSN` | optional |
| `SENTRY_RELEASE` | optional |
| `WEB_DIST_DIR` | optional |
| `SEED_DEMO_EMAIL` | optional |
| `SEED_DEMO_PASSWORD` | optional |
<!-- /generated -->

**Protection against cost and abuse**

- **Rate limiter in front of the provider:** Every call to a language or embedding model runs through a sliding-window limiter
  (requests and tokens per minute, in a queue). It lives in memory: a restart resets it, several
  instances would count separately. It protects the quota at the provider, not against single users.
- **Per-user limit** (24 hours sliding) for questions and Studio outputs, **emergency brake** in tokens per day for everyone, one running
  call per user, upper bound per answer (`MAX_OUTPUT_TOKENS`), limits for notebooks and sources. Usage in `usage_events`,
  report with `pnpm report:usage`. The levels are assumptions until measured (see [BACKLOG.md](BACKLOG.md)).
- **Content hash per user:** The same document is never read or embedded twice.
- **Guests:** limited per hour, per address and hour (last entry of `X-Forwarded-For`, set by Caddy; in process memory), concurrently and in lifetime (`GUESTS_*`, `GUEST_LIFETIME_DAYS` above). There is deliberately no captcha ([BACKLOG.md](BACKLOG.md)).
- **Web search** (Tavily): no limit of its own; an exhausted Tavily quota is passed on as 429.
- **No kill switch** via environment variable; whoever wants to block everything stops the container.

**Two Google projects:** one for building and testing, one for the live demo, so tests do not use up the reviewers'
quota ([DEPLOYMENT.md](DEPLOYMENT.md)).

**Notice in the demo:** do not upload sensitive documents; for the free tier Google's terms on data use may apply.

## Operations and quality tools

- **Observability:** Every request carries an ID (`X-Request-Id`, in access log, log lines and error responses). Job errors and rejected uploads are logged with kind, size and stage, never with file name or content.
  Sentry (EU) reports unexpected errors (500, import jobs, job queue, chat) in [observability/](../apps/api/src/observability) and [error-reporting.ts](../apps/web/src/lib/error-reporting.ts). Only an allow-list of fields is sent
  (`scrubEvent`: error kind, stack, release = commit, environment, tags, source-map identifiers), never error text, variables, source text, request or user. Without `SENTRY_DSN` the SDK does not start. Source maps of the web go to Sentry
  during the deploy build and are deleted (`SENTRY_AUTH_TOKEN` as a build secret). The Sentry MCP server is set up per user, not in the repo, and stays switched off. There are deliberately no persistent logs ([BACKLOG.md](BACKLOG.md)). What follows with growth: [SCALING.md](SCALING.md). Targets: [SLO.md](SLO.md), guide for alerts: [RUNBOOK.md](RUNBOOK.md).
- **Row-level security (RLS):** Second layer behind invariant 3. All nine tables with a user reference have a policy (`user_id = current_setting('app.user_id', true)`, for `chunks`, `source_uploads` and `notebook_sources` through the parent row); [rls.ts](../apps/api/src/db/rls.ts) defines them, `drizzle-kit` generates the migrations. The app connects as `nlm_app` (not the owner, no `BYPASSRLS`), every route runs in `forUser`, a transaction with the user set; without a user Postgres returns no rows. Work that belongs to no one (guests, daily budget, sweeps, ingestion, migrations, job queue) uses the owner connection `systemDb` (`DATABASE_OWNER_URL`). The vector search reads an exact scan over the selected sources; the policy adds small semi-joins, no index is lost.
- **Supply chain:** Dependabot (npm, Actions, Docker; weekly), `pnpm audit`, Semgrep and Trivy (dependencies, secrets, Dockerfile; SBOM as a CI artifact) in CI, GitHub secret scanning with push protection.
- **Eval:** `pnpm eval:live` runs 34 golden questions ([golden-questions.json](../apps/api/src/eval/golden-questions.json)) through the same code as the chat. The key is `EVAL_GEMINI_API_KEY` (never `GEMINI_API_KEY`, no fallback).
  A full run is compared with [baseline.json](../apps/api/src/eval/baseline.json) and ends with exit code 1 if a measure falls by more than 5 percentage points (`GATE_TOLERANCE`, estimated). The baseline values are in the file; whether the set can still show improvements is in the [backlog](BACKLOG.md). When the free-tier quota is exhausted the run aborts and names the remaining IDs for `--ids`.
- **Mutation tests:** `pnpm mutation` (StrykerJS, Vitest runner) on `apps/api/src/core`, about 2 minutes, in CI only manually or weekly ([mutation.yml](../.github/workflows/mutation.yml)). The `break` threshold is in [stryker.config.json](../stryker.config.json); raise it only when real survivors are added. Runner 10.0.0 does not adapt the name filter to Vitest 5 ([issue 6210](https://github.com/stryker-mutator/stryker-js/issues/6210)); a pnpm patch in `patches/` fixes that and goes away as soon as the runner does it.
- **Docs:** Tables with limits and variables are generated from the code (`pnpm docs:generate`, checked in `pnpm audit:docs`). [docs-map.json](docs-map.json) ties code paths to their document; a commit needs the document or
  `Docs: n/a, <reason>`. Checked in the hook `.husky/commit-msg` and in CI. No counts (tests, files) in the docs. A by-hand comparison of document against code at the end of a feature.
- **Usage:** Every model call writes a row to `usage_events` (30 days), evaluation with `pnpm report:usage` (tokens per call; one chat question consists of up to four calls). Web search is not counted.
  From 75 % the UI shows "Noch N Fragen heute." (N questions left today), at the limit it locks the input field and names the time of release; when the daily brake is reached it says "Heute ist das Kontingent der Demo aufgebraucht" (today the demo's quota is used up).

## Risks and open points

The biggest risk is cost and quota in the live demo; per-user limits and the daily brake limit it, but their levels are not measured. Parsing quality and latency follow.

- **Quota and cost:** Several accounts of one person get around the per-user limit; the daily brake catches that. The marker "one running call per user" lives in memory and is right only with one container.
- **Embeddings:** The limiter throttles by estimated tokens. How the provider counts a batch is not checked.
- **Latency:** GPT-6 Luna (not measured in the spike) had, according to Artificial Analysis, a time to first token of about 139 seconds at max reasoning (Gemini 3.5 Flash-Lite about 8.8 seconds). Not measured at a low level.
- **Parsing by LLM** is not deterministic and can omit things. Countermeasure: spot-check tests.
- **ParseBench** comes from LlamaIndex, covers enterprise PDFs and contains no DOCX. Hence the own spike.
- **Data use on the free tier:** Read the terms, notice in the demo.
- **Hosting:** One Hetzner server; deploy with dump, health check and rollback ([DEPLOYMENT.md](DEPLOYMENT.md)).
- **Billing:** ❓ Whether a hard budget limit is set and whether automatic top-up runs is not documented.
- **Prices and benchmarks** from third-party sources: check on the official pages before a decision (rule 12 in [AGENTS.md](../AGENTS.md)).
- **Take-home repos** are only a source of ideas: do not copy code.
