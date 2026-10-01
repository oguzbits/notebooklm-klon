# Agent Rules

Canonical instructions for every coding agent in this repo. `CLAUDE.md` only imports this file.
Project context and stack: [docs/PLAN.md](docs/PLAN.md). Use `pnpm`, never `npm` or `yarn`.

## 1. Layers (enforced by `pnpm depcruise` and ESLint)

- **`packages/shared`**: Zod schemas, inferred types and `as const` dictionaries. Nothing else: no
  functions, no classes, no Node modules, npm only `zod`. It is the single source of truth (SSOT)
  for every contract between api and web, and for the citation schema.
- **`apps/api`**: `src/core` is pure, deterministic logic without I/O (no Hono, DB, jobs, AI
  providers). Routes are thin adapters: parse input with Zod, resolve the user from the session,
  delegate to core, format the response. DB, jobs and AI providers are adapters behind core.
- **`apps/web`**: React 19. Server state only through TanStack Query. Hooks never import
  components. `apps/web` never imports runtime code from `apps/api`; the only allowed import is
  `import type` of `AppType` for the Hono RPC client.
- `apps/api` and `apps/web` never import each other's runtime code. No circular dependencies.
- **SoC beats DRY.** Similar code in two independent features is fine. Extract only on the third
  identical use (Rule of Three). No speculative abstractions, no meta-frameworks (YAGNI).
- Fail fast: DB and provider errors throw. No silent `catch`, no fallback data in production paths.
  One exception: removing a file from the object store after the database change is best effort and
  logged (`storage/remove-quietly.ts`).
- Filtering, search and aggregation run in PostgreSQL, never by loading whole tables into Node.
- Strict types: no `any`, no `@ts-ignore`, no `as unknown as`, no `export *`. Derive types with
  `z.infer`, never write a parallel type by hand.
- Constants: a value that steers logic (status, type, role) is an UPPER_SNAKE value in an
  `export const X = {...} as const` dictionary and is imported everywhere, tests included
  (`pnpm audit:magic`). Use UPPER_SNAKE values so ESLint and the audit both apply.

## 2. Product invariants

1. **Citation contract.** Every statement in an answer references one or more chunk IDs that were
   part of the context sent to the model. The server validates this and rejects or strips citations
   that are not in the context. Prompt, server and UI use the one schema from `packages/shared`.
2. **Idempotent ingestion.** A source is identified by the SHA-256 of its content per user. The same
   content is never parsed or embedded twice.
3. **Retrieval scope.** Every chunk query filters in SQL by `userId`, `notebookId` and the selected
   `sourceIds`. Authorization lives in the API; identity comes from the server-side session, never
   from a client-supplied ID.
4. **Model IDs and limits only from config.** Never write a model name in code (ESLint blocks it
   outside `apps/api/src/config`). All LLM and embedding calls go through the rate limiter.
5. **No real API calls in tests.** MSW rejects every unmocked request. Record LLM responses once,
   replay them offline. Live calls exist only in `pnpm eval:live` and the spike.
6. **SSRF protection for URL import.** Only http/https; resolve DNS and reject private, loopback and
   link-local addresses (again after every redirect); cap redirects, time and size.
7. **No document content in logs.** Log IDs, lengths, durations and token counts only. Structured
   JSON lines, no `console`.
8. **Env only via `apps/api/src/config/env.ts`.** Never read `process.env` elsewhere. Never print or
   edit `.env*` files and never commit them; only `.env.example` is tracked. The one exception: a reviewed
   spike script may run as `node --env-file=.env.local spikes/<name>.mjs`, so Node loads the key
   and the agent never sees it (see `.claude/hooks/bash-rules.mjs`). The guard checks the form of the
   command, not the script: a spike never prints environment values.
9. **UI states.** Every async view handles empty, loading, error (with retry) and pending
   (disabled controls, no double submit). One canonical trigger per user intent.
10. **UI language is German** and free of technical terms (no "RAG", "Embedding", "Chunk" for
    users). Use shadcn primitives and semantic tokens, no ad-hoc HTML controls or raw palette colors.
11. **Migrations** are generated with `drizzle-kit`. Never hand-edit generated SQL or snapshots.
12. **Verify before deciding.** Never rely on memory for model IDs, prices, limits or library APIs.
    Check the current docs first and say where you are unsure.
13. **Portable docs.** No absolute machine paths in files; use relative Markdown links.
    Update docs in the same change when architecture or contracts change.

## 3. Workflow

**Pre-flight (before touching code)**, in a few lines: scope, what is explicitly out of scope, the
command that proves success. Skip it for copy changes, pure styling and Markdown.

Then: contract first (`packages/shared`), failing test first, smallest diff that passes.
Refactor only on a trigger: third identical use, or a failing quality gate.
UI changes are inspected in a browser (chrome-devtools MCP, set up per user and not in the repo, or
Playwright) before they count as done.
The logs are long: [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md) is about 60 KB, so search it
(`rg`) and read only the section you need.

**Commands**

| Command                              | Purpose                                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| `pnpm check`                         | typecheck, lint, depcruise, knip, jscpd (2 %), magic-string audit |
| `pnpm test`                          | Vitest, offline                                                   |
| `pnpm test:db`                       | Postgres and S3 tests (needs `pnpm db:up`, Docker)                |
| `pnpm e2e`                           | Playwright browser tests (needs `pnpm db:up`)                     |
| `pnpm audit:duplication:details`     | lists the duplicates when `pnpm check` reports too many           |
| `pnpm --filter @nlm/api db:generate` | drizzle-kit: new migration from `apps/api/src/db/schema.ts`       |
| `pnpm format:check`                  | Prettier (staged files are formatted by lint-staged)              |
| `pnpm depcruise:graph`               | writes `architecture.mmd` for the README                          |

**Commits and pushes are allowed** once `pnpm check` and `pnpm test` are green (the Husky hooks run
them; never skip them with `--no-verify`, never force-push, never rewrite remote history). One
topic per commit, imperative Conventional Commit subject, never stage `.env*`. Work on a feature
branch and merge to `main` only when the whole slice is green. The hooks do not run `pnpm test:db`,
`pnpm e2e` or Semgrep, CI does: after a push look at `gh run list --branch main --limit 1`, and fix a
red run before starting new work.
**Dependencies may be added without asking.** Verify the current docs first (rule 12), keep the set
small (YAGNI), and record why in the commit message.
**Small decisions are yours.** Where the plan leaves something open, choose the simplest option
that fits the plan and log it with the reason in [docs/ENTSCHEIDUNGEN.md](docs/ENTSCHEIDUNGEN.md).
Ask the user only for things that change scope, cost or data protection.

**Definition-of-Done receipt** (end of every feature; not for docs, config or fixes of a review):

```markdown
### DoD: <task>

- [x] Contract: schemas in `packages/shared` (or not needed)
- [x] Tests: <n> passing, `pnpm check` green, no real API calls
- [x] Invariants: session-scoped queries, citation contract, ingestion hash, logs (as applicable)
- [x] UI: four states, German copy, verified in browser (or not applicable)
- [x] Docs: updated (or not needed)
- [ ] Out of scope / open: <list>
```
