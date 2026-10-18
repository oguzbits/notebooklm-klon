# Runbook

One guide per alert: symptom, check, action. Commands run on the server as `deploy` in `/srv/nlm` with the shorthand
`dc() { docker compose -f docker-compose.prod.yml --env-file server.env "$@"; }` (see [DEPLOYMENT.md](DEPLOYMENT.md#operations)).
Targets and numbers: [SLO.md](SLO.md).

## Uptime run red: `/health` does not answer

1. `curl -si https://<hostname>/health` from outside. If there is no certificate or no answer: Caddy or DNS (`dc logs --tail 100 caddy`).
2. `dc ps`: Is `app` or `db` not `healthy`? Look at `dc logs --tail 200 app`.
3. After a deploy: the workflow rolls back by itself; whether `nlm-app:current` is the old image is shown in the deploy run. Otherwise roll back by hand (section "Back to the previous version" in DEPLOYMENT.md).
4. A container killed by Docker: `docker inspect <name> --format '{{.State.OOMKilled}}'`. If `true`, check the memory limits in the Compose file.
5. Database broken or data gone: restore from the dump (section "Backup and restore").

## Uptime run red: `stalledSources` is greater than 0

At least one source has been waiting for its ingestion job for more than 15 minutes.

1. `curl -s https://<hostname>/health`: How many? If the number stays the same or rises over several runs, the queue is stuck.
2. `dc logs --tail 200 app | grep -E "ingestion job|queue error"`: failures appear with source ID, stage and duration, never with content.
3. If every job fails at the provider (Gemini quota, key): read the error name in the log; check the daily brake and the free-tier limit.
4. `dc restart app` restarts the worker. Sources whose job is older than one hour (`INTERRUPTED_JOB_AFTER_MS`) are marked "unterbrochen" (interrupted) on startup; users can read the source again.
5. If that does not help: look for the cause in Sentry (origin `ingestion` or `queue`), the source ID is set as a tag.

## Error in Sentry (origin `request`, `ingestion`, `queue`, `chat`)

1. Search for the tag `requestId` (if present) in Caddy's access log and in the app's log lines: `dc logs app | grep <requestId>`.
2. The release (= commit) in the event shows which version throws the error. If it appeared with the last deploy, roll back.
3. A user complaint contains the "Referenz" (reference; the first eight characters of the request ID): search the log with it.

## Quota of the model provider exhausted

Symptom: chat and ingestion fail with errors from the provider, the UI reports the daily limit or an error.

1. `pnpm report:usage` (locally against the database) shows tokens per call and day.
2. If the daily brake (`DAILY_TOKEN_BUDGET`) is reached, that is intended; it opens in the next window. Change it only after looking at the credit at the provider.
3. If the credit at the provider is empty, top it up there; no restart is needed.

## Guests cannot be started

Answer 503 on `/api/guest`: Either the sample notebook is missing (the seed did not run), or one of the limits is reached
(`GUESTS_PER_HOUR`, `GUESTS_PER_IP_PER_HOUR`, `GUESTS_ALIVE`). A per-address limit hits many users behind one address at once.
The per-address count lives in process memory: `dc restart app` resets it if a script has used up the hour.

## Users suddenly see no data (row-level security)

The app connects as the role `nlm_app`; Postgres returns to it only the rows of the user the request runs for. Empty lists with a
healthy database usually mean: a query ran without `forUser` and therefore without a user (it then returns nothing, it leaks nothing).
`dc logs app` and Sentry show the route. As an immediate measure remove `APP_DB_USER` and `APP_DB_PASSWORD` from `server.env` and run
`dc up -d app`: the app connects as the owner again, without row-level security. Then fix the bug, do not weaken the policy.

## Sentry alert rules (create once in the Sentry project)

This can only be set up in Sentry's UI, not from the repo.

- New issue in `notebooklm-hono` with origin `queue` or `ingestion`: email immediately.
- More than 5 events in 10 minutes in the same issue: email.
- New issue in `notebooklm-react`: a daily summary is enough.

## After the incident

A short note as commit text or in the backlog: what it was, how it was noticed, what changes (alert, test, document).
