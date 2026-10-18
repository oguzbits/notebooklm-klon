# Service-level objectives

What "good enough" means, so that an alert has a reason and a bad month becomes visible. The target values are
proposals, not derived from measurements; they are adjusted as soon as there are measurements. What is measured and what
is not is in the last column. Guide for an alert: [RUNBOOK.md](RUNBOOK.md).

| Objective               | Target (30 days)                                                         | Measurement                                                                  | Measured today                                  |
| ----------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Availability            | 99.5 % of the checks of `/health` answer with 200                        | Workflow [uptime.yml](../.github/workflows/uptime.yml), every 15 minutes     | Yes, as a red or green run; no evaluation       |
| Ingestion completes     | No source longer than 15 minutes without a result (`stalledSources` = 0) | `/health`, field `stalledSources`                                            | Yes, in the same workflow                       |
| Error-free requests     | 99 % without a 5xx response                                              | Sentry (unexpected errors), Caddy access log                                 | Partly: errors yes, total number of requests no |
| Time to first chat byte | 95 % of the answers start within 5 seconds                               | Time to the first piece of the stream                                        | No                                              |
| Citation accuracy       | No drop of the baseline measures by more than `GATE_TOLERANCE`           | `pnpm eval:live` against [baseline.json](../apps/api/src/eval/baseline.json) | Yes, by hand and on changes to the chat         |
| Data safety             | Last dump not older than 26 hours; restore checked monthly               | `/srv/nlm/backup.log`, [restore-check.sh](../deploy/restore-check.sh)        | No, by hand only                                |

## Error budget

At 99.5 % availability about 3.6 hours of downtime are allowed in 30 days. If the budget is used up, the cause comes before new
features: a post-mortem (what, why, what changes) in [BACKLOG.md](BACKLOG.md) or as commit text.

## What is missing for real measurement

Time to first byte and the number of all requests need metrics (see [SCALING.md](SCALING.md), "Metrics and tracing").
Until then these objectives are intent, not a promise.
