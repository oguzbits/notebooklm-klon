# Status and backlog

From the full review of 2026-10-02 (four read-only checks and one journey run on the live site).
The finished items are in the
git history; this file lists only what is open or deliberately not built.

## Status

All findings of level "High" (H1 to H7) are fixed. Of the medium ones, M1, M2, M3, M5 and M8 to M17 are done, M6 (title cut to 200 characters, DOCX and PPTX limited to 100 MB unpacked), M7 except the plan hint;
M10 is deliberately not built (see below); M4 does not apply (see below). The feature gaps from the review
(re-ingest, export, delete account, stop button) and the file types PDF link, images, audio, PPTX and YouTube are built.

Gates at the latest state: `pnpm check`, `pnpm test`, `pnpm test:db` and `pnpm e2e` green.
Not checked: screen readers on real devices, real mobile devices, Semgrep locally (runs in CI).

## Decisions of the user

- Privacy policy and legal notice: not needed.
- Copy of the backup to another server: not needed. A dump before every deploy and a restore check (`deploy/restore-check.sh`) exist.
- Hint about the Gemini plan in the upload dialog: postponed while the site is a demo. The README warns against uploading sensitive documents.

## Open

| #   | Topic | Finding | Fix |
| --- | ----- | ------- | --- |

M4 (HNSW index with filter) does not apply: the search orders by distance over the CTE `scoped`, which is filtered through joins on user, notebook and sources ([db/retrieval.ts](../apps/api/src/db/retrieval.ts)). The HNSW index could not be applied over that (0 scans in `pg_stat_user_indexes` on the dev database) and only cost memory and insert time, so it was dropped. The scan is exact and loses no hits to a downstream filter. Re-add it if the search is ever aligned to an index.

Until 2026-10-15 not built as "demo" (see "Operations, security, scaling" below, re-evaluated since 2026-10-18): persistent logs (Sentry reports errors; Docker logs are lost on deploy) and the server hardening M10 (fail2ban, `deploy` out of the Docker group, Trivy; the dependency audit runs in CI, a moderate gap in esbuild via drizzle-kit affects only the dev server). sslip.io shares certificate limits; an own domain only on request.

## Operations, security, scaling

The path beyond these items (stages, bottlenecks, measures) is in [SCALING.md](SCALING.md).

Standard: the site is treated like a product of a team, maintainable and scalable (decision of the user, 2026-10-18). It counts as a demo only for **cost**: no tool that costs money or needs its own servers as long as there is no reason for it.
This replaces the earlier decision of 2026-10-15 (logs and M10 "because demo"). Tool names are from memory; check them against the current docs before building (rule 12).

### Being built (free or very cheap)

| Topic                  | Instead today                                                                                                                                 | Best tool                                                                                  | Trigger to catch up                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Alert on a stuck queue | `/health` reports `stalledSources`, the uptime run turns red; Sentry rules are in the runbook but not yet created                             | Sentry Alerts and Cron Monitors on queue depth from `/health`                              | Jobs stay unnoticed                          |
| Row-level security     | Built, tested in CI, `APP_DB_USER` and `APP_DB_PASSWORD` are in `server.env` ([DEPLOYMENT.md](DEPLOYMENT.md#row-level-security-role-nlm_app)) | Open: E2E server, seeds and job queue run as the owner                                     | More sensitive data or several teams         |
| Image signing (cosign) | Trivy scan and SBOM in CI; the image goes to the server over SSH, not through a registry                                                      | cosign (Sigstore) with artifact attestations, needs a registry (GHCR) and a changed deploy | Deploy through a registry, or real user data |

### Needs a new account or money (backlog, only after approval)

Rule: anything that needs a new account, key or an additional server is not built by the agent alone.

| Topic                    | Instead today                                                                           | Best tool                                                                   | Trigger to catch up                                   |
| ------------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Captcha for guests       | Limit per address, per hour, concurrent; daily brake for tokens                         | Cloudflare Turnstile (free, no tracking)                                    | Guests are deliberately locked out despite the limit  |
| Persistent, central logs | Docker logs (lost on deploy), Sentry                                                    | Grafana Alloy with Loki (Grafana Cloud) or Better Stack                     | Errors can no longer be narrowed down without logs    |
| Staging environment      | CI with DB, S3 and E2E, deploy with health check, image `nlm-app:previous` for rollback | Second small Hetzner server with the same `deploy.yml`, GitHub Environments | Several developers, or schema changes without a trial |

### Postponed (costs money or needs growth)

| Topic                         | Instead today                                              | Best tool                                                                                                  | Trigger to catch up                                   |
| ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Load tests                    | Quota and daily brake limit the load                       | k6 (scripts in TypeScript/JS, runs in CI)                                                                  | Advertising for the site, or more than about 50 users |
| Metrics, dashboards, tracing  | Sentry for errors, `X-Request-Id` in the log, uptime check | OpenTelemetry SDK with Grafana Cloud (free plan); as a smaller step Sentry tracing, which is already there | More than one server, or a target for response times  |
| Rate limiter across instances | In process memory, one server                              | Table in Postgres; if needed `rate-limiter-flexible` with Postgres or Redis storage                        | Second API instance                                   |
| Multi-region, orchestration   | One Hetzner server with backup and restore check           | Hetzner Load Balancer with a second server; k3s only with many services                                    | Availability target above that of one server          |
| Feature flags                 | Deploy with rollback                                       | GrowthBook or Unleash (self-hosted), interface OpenFeature                                                 | Partial rollouts for user groups                      |

Small items:

- `use-sources.ts`: polling every 2 s without backoff while a source is working. Left on purpose: a short, cheap query during a few minutes.
- Hash over raw HTML bytes: dynamic pages are never recognized as a duplicate.
- Raw controls instead of shadcn in a few places (`quiz-option.tsx`, `studio-tiles.tsx`, `library-row.tsx`), not assessed one by one.
- `pdf-lib` has had no release since November 2021, but works.

## From the plans (as of 2026-10-15)

The plans are finished and deleted (git history, the commit before this one). Still open from them:

- **Eval:** n >= 3 per question and the gate threshold from the variance instead of estimated; corpus (`spikes/corpus`) with a clarified license into the repo; offline replay of the model answers (invariant 5);
  **harder questions** (compare sources, numbers from tables, German questions about English sources), because the set shows nothing at 100 %.
- **RAG experiments**, only with harder questions, one variable per experiment and a run with n >= 3, quantify and agree on re-embedding beforehand:
  E1 whole sources instead of search when they fit; E2 full text with German stemming instead of `simple` (migration); E3 chunk size 800, 1500, 2500; E4 number of passages 6, 12, 20; E5 source titles in the embedding text; E6 reranker (only if E1 to E5 are not enough).
- **Temperature and `thinkingLevel`:** today 0 everywhere and unset (`ai/gemini-chat.ts`, `ai/gemini-pdf-parser.ts`). Gemini 3 recommends 1.0 according to the docs (re-read). If measured: `GENERATION = { CHAT, QUERY, PDF, STUDIO }` in `apps/api/src/config`,
  per role 0 against 1.0, n >= 3, roughly 1 to 2 euros. One test per role that the request body carries the value from the configuration.
- **Calibrate limits:** the emergency brake of 2 million tokens per day follows from a credit of about 4 EUR (2026-10-15) and the prices of gemini-3.5-flash-lite (0.30 USD per million input tokens, 2.50 USD per million output tokens including thinking; ai.google.dev/gemini-api/docs/pricing, read by an agent on 2026-10-14, not checked by hand); one chat question cost about 0.35 cents when measured on 2026-10-15. Set the per-user limits and `MAX_OUTPUT_TOKENS` from real usage (`pnpm report:usage`). Whether `maxOutputTokens` counts thinking tokens is not clear: the thinking docs say for `max_output_tokens` "including thought tokens"
  (ai.google.dev/gemini-api/docs/thinking, read by an agent); the reference of `generationConfig.maxOutputTokens` was not read; when it is reached the output can be cut or empty. Measure with one call before reducing it.
- **Docs:** add a date comparison of `Stand` (as-of) against the last change of an assigned path (layer 3 of the former plan 2) if docs go stale despite `docs-map.json`.

## Measurement pending

The weight 0.5 of the full-text search in the hybrid search is justified only by the language difference, not by a measurement:
on the 18 spike questions hybrid is no better than pure vector search (see [SPIKE-RESULTS.md](SPIKE-RESULTS.md)).
Check again with more questions (`pnpm eval:live`).

## Later

| Topic                       | Note                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XLSX and CSV                | The Studio context (`STUDIO_MAX_CHARS` 120 000) is divided evenly among the sources, the start of each source stays. Large tables would be cut off, clarify beforehand.                               |
| HTML file                   | Little use.                                                                                                                                                                                           |
| Footnote digits in numbers  | The footnote digit of a PDF sits in the text next to the number (`Erwerbspersonen2`); the number check reads it as part of the number or as a number of its own. Not measured how often this happens. |
| Keyboard shortcuts          | Not built.                                                                                                                                                                                            |
| Search across all notebooks | Not built.                                                                                                                                                                                            |

Deliberately not: EPUB, Google Docs and Slides (see [DESIGN-COMPARISON.md](DESIGN-COMPARISON.md)), sharing, audio and video overview,
Deep Research, Drive, thumbs rating, PDF export, undo on delete (every delete asks first).

## Not checked against the current docs

Hetzner prices and specs, fork-PR settings on GitHub, `EXPLAIN` of the vector search, the source types of NotebookLM
itself (rule 12 of AGENTS.md: look there before a decision).

- The overview of a single source is stored once per source, so it keeps the language of its first request. Per-locale storage needs a migration.
- The English UI has not been checked in the browser or in the Playwright tests (they run in German).
