# Growth path

What changes when a server with few users becomes a product for a team and many users.
Each row names the first bottleneck, the measure, a tool and the trigger. What applies today is in
[PLAN.md](PLAN.md), what is open in [BACKLOG.md](BACKLOG.md). Check tool names against the current docs before building.

Stages: **A** one server (today), **B** a team runs it, two instances, **C** many users, several regions.

## Runtime and data

| Area                          | Bottleneck                                                | Measure                                                                                                                                               | Stage |
| ----------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| API and worker in one process | A heavy ingestion slows the chat, a crash takes both down | Worker as its own container with the same image (pg-boss needs no rework), its own memory and CPU frame                                               | B     |
| Rate limiter                  | Counts in process memory, two instances count separately  | State in Postgres (table, window by SQL); Redis/Valkey only when Postgres is the bottleneck                                                           | B     |
| Guest limit per address       | Same problem, in process memory                           | Move to Postgres together with the rate limiter                                                                                                       | B     |
| Chat stream (SSE)             | Open connections tie up processes                         | More instances behind the load balancer, connection limit per instance, sticky sessions not needed (state is in the DB)                               | B     |
| Studio runs in one request    | Long material keeps the request open                      | As a job in the queue, result by polling (as with sources)                                                                                            | B     |
| Postgres                      | One instance, connections, vector search                  | Connection pool (PgBouncer), read replica for search, partitioning of `usage_events`, an HNSW index only once the search is aligned to it (`EXPLAIN`) | C     |
| Object store                  | Cover images are not in the backup                        | Include in the backup (stage A is enough); at C a managed S3 service with versioning                                                                  | A, C  |
| Queue (pg-boss)               | `retryLimit 0`, because the job deletes the upload bytes  | Delete the bytes only after success, then retry with backoff and a dead-letter state                                                                  | B     |
| Model provider                | One provider, one quota                                   | Second provider behind the same interface (`ai/`), fallback and cost comparison, batch calls for embeddings                                           | C     |

## Reliability and operations

| Area                | Measure                                                                                                             | Stage |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ----- |
| SLOs                | Targets for availability, time to first byte in the chat, citation accuracy; alert when the error budget is used up | B     |
| Runbook             | One guide per alert: symptom, check, action, rollback                                                               | B     |
| Metrics and tracing | OpenTelemetry with a backend (Grafana Cloud or self-hosted), traces from the request to the model call              | C     |
| Central logs        | Forwarding of the JSON lines (Alloy and Loki, Better Stack), define retention                                       | B     |
| Staging             | Same deploy script on a second environment, migrations there first                                                  | B     |
| Release             | Blue/green or rolling with health check; migrations backward compatible (first extend, then replace)                | B     |
| Feature flags       | OpenFeature with GrowthBook or Unleash, partial rollouts                                                            | C     |
| Disaster drill      | Restore check regularly in CI, define RPO and RTO targets                                                           | B     |
| Multi-region        | Second site, database replication, DNS failover; only with an availability target above that                        | C     |

## Security and privacy

| Area                     | Measure                                                                                                                                             | Stage |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Access protection        | Row-level security as a second layer, app role without owner rights, `SET LOCAL` per request                                                        | B     |
| Login                    | Default for all routes, exceptions explicit; two-factor and session management                                                                      | B     |
| Bot and abuse protection | Turnstile for guests, limits per account and address in Postgres, anomaly alert                                                                     | B     |
| Supply chain             | SBOM, image scan, signing with attestation, pinned base images                                                                                      | B     |
| Secrets                  | Secret manager instead of `server.env`, rotation, separate keys per environment                                                                     | B     |
| Privacy                  | Privacy policy, data processing agreement with the model provider, deletion concept (delete account exists), export, retention periods, data region | C     |
| Encryption               | Encryption of the backups and the object store at rest                                                                                              | B     |
| Review                   | Regular penetration test, threat model per new attack surface                                                                                       | C     |

## Quality and team

| Area                     | Measure                                                                                                        | Stage |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ----- |
| Load tests               | k6 against staging with fixed scenarios (chat, ingestion), derive the limits in `LIMITS` from them             | B     |
| Eval                     | More and harder questions, repetitions per question, offline replay, gate in CI (details in the backlog)       | A, B  |
| Accessibility            | Automatic check (axe) in E2E, screen reader test on real devices                                               | B     |
| Collaboration            | Pull requests with required review, CODEOWNERS, branch protection, architecture decisions as short files (ADR) | B     |
| Cost                     | Budget alert per day and month, evaluate cost per user from `usage_events`                                     | B     |
| Several teams or tenants | Organizations, roles, shared notebooks; requires thinking data model and RLS together                          | C     |
