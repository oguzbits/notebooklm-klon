# Deployment and operations

How the app runs on a Hetzner server, and how to set it up, update and restore it there.

## Overview

```
Internet ──443/80──> Caddy ──> app (Hono + built web, port 3000) ──> db (Postgres + pgvector)
                                                                    └──> s3 (SeaweedFS, cover images)
```

| Part   | File                                                         | Job                                                              |
| ------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Stack  | [docker-compose.prod.yml](../deploy/docker-compose.prod.yml) | Four containers; only Caddy is reachable from the internet       |
| Proxy  | [Caddyfile](../deploy/Caddyfile)                             | Fetch and renew the HTTPS certificate, forward without buffering |
| Setup  | [provision.sh](../deploy/provision.sh)                       | One command from your own machine: server, `server.env`, secrets |
| Backup | [backup.sh](../deploy/backup.sh)                             | A `pg_dump` daily at 03:15 and before every deploy, kept 7 days  |
| Deploy | [deploy.yml](../.github/workflows/deploy.yml)                | Builds the image, sends it over SSH, starts the stack            |

- The image is built in GitHub Actions (`docker build`) and transferred with `docker save | ssh docker load`. The server
  needs neither a registry nor access to the repository.
- The database listens only on `127.0.0.1` of the server. From outside it is reachable only through an SSH tunnel.
- All secrets live in `/srv/nlm/server.env` (mode 600) and in `/srv/nlm/s3.json`. Both are created on the server
  and are never in the repository.
- The app migrates the database on start and creates the bucket for the cover images itself.

## One-time setup

What only you can do is in bold here.

1. **Book a server:** Hetzner Cloud CX23 (2 vCPU, 4 GB RAM, 40 GB), Ubuntu 24.04, register your SSH key.
2. **Firewall:** In the Hetzner console create a firewall with inbound TCP 22, 80 and 443 and assign it to the server.
3. **Set up the server, one command** on your machine, in the repository: `deploy/provision.sh <IPv4 or hostname>`.
   Hostname without an own domain: `<IP with hyphens>.sslip.io`, for example `203-0-113-7.sslip.io` for `203.0.113.7`
   (the script builds it itself). With an own domain, first set an A record to the IP and pass the domain.
   Requirements: login as root with your SSH key, `gh auth login`, a `.env.local` with the values
   `GEMINI_API_KEY`, `AI_MODEL`, `PARSE_MODEL`, `EMBEDDING_MODEL` (for production a key from a separate
   Google project, so tests do not use up the reviewers' quota; check model names against the current Google docs
   first). The script:
   - shows the SSH fingerprint of the server; you compare it with the Hetzner console (Server > Overview) and confirm,
   - creates a new key pair for the user `deploy` and runs [bootstrap.sh](../deploy/bootstrap.sh)
     (Docker, 2 GB swap, user `deploy` with key only, `ufw`, nightly backup, `server.env` with freshly generated
     secrets),
   - writes the values from `.env.local` over SSH into `/srv/nlm/server.env` (only lines with `FILL_IN`, nothing is
     printed, an unset `PARSE_FALLBACK_MODEL` is dropped, a `TAVILY_API_KEY` is taken over) and asks for
     `SEED_DEMO_EMAIL` if it is missing,
   - checks the login as `deploy` and sets the GitHub secrets `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.

   A second run is safe: it replaces the deploy key pair on the server and in GitHub, filled-in values in
   `server.env` stay. Do not change in `server.env`: `SITE_ADDRESS`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `S3_*`. A
   new `POSTGRES_PASSWORD` applies only when the volume is first created; a new `BETTER_AUTH_SECRET` signs everyone out.
   By hand works too: the steps are in comments in [provision.sh](../deploy/provision.sh) and in
   [bootstrap.sh](../deploy/bootstrap.sh).

4. **First deploy:** Actions > Deploy > Run workflow. After that it runs after every green CI run on `main`.
   For Sentry: put `SENTRY_DSN` (project `notebooklm-hono`) in `server.env` and set the GitHub secrets `SENTRY_WEB_DSN`
   (project `notebooklm-react`) and `SENTRY_AUTH_TOKEN` (organization token, for the source maps). All of this is optional; without the values nothing is sent.
5. **Create the demo notebook** (once, see below).
6. **Uptime check:** the workflow `Uptime` calls `https://<hostname>/health` every 15 minutes; a red run
   is the alarm (GitHub sends an email). Optionally UptimeRobot as well. Then enter the live link and demo access in
   the [README](../README.md).

### Create the demo notebook

`pnpm seed:demo` is not in the production image and therefore runs on your machine, in the repository, against the
database of the server through an SSH tunnel:

```bash
ssh -N -L 5433:127.0.0.1:5432 deploy@<hostname>      # shell 1, leave open
```

In shell 2, in the repository, set `DATABASE_URL=postgresql://nlm:<POSTGRES_PASSWORD>@127.0.0.1:5433/nlm`, `SEED_DEMO_EMAIL` and
`SEED_DEMO_PASSWORD` in the shell (variables from the shell take precedence over your local `.env.local`; the Google key
and model names can come from it), then run `pnpm seed:demo`. The command ingests three sample documents once (model calls, so
quota) and can be repeated. The `POSTGRES_PASSWORD` is in `/srv/nlm/server.env`.

## Operations

All commands on the server as `deploy`, in the directory `/srv/nlm`. Shorthand:
`dc() { docker compose -f docker-compose.prod.yml --env-file server.env "$@"; }`

| Task                    | Command                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| Check the state         | `dc ps` and `curl -s https://<hostname>/health`                     |
| App logs                | `dc logs -f --tail 100 app`                                         |
| Memory and CPU          | `docker stats --no-stream`                                          |
| Roll out a new version  | Merge to `main` (after green CI) or Actions > Deploy > Run workflow |
| Roll out an old version | Actions > Deploy > Run workflow with the older branch or tag        |
| Restart                 | `dc restart app`                                                    |

Memory limits in [docker-compose.prod.yml](../deploy/docker-compose.prod.yml): app 1.5 GB, Postgres 1 GB (`shared_buffers`
256 MB), SeaweedFS 512 MB, Caddy 256 MB. These are estimates, not a measurement: whether they fit is shown by `docker stats`, and a
container killed by Docker shows up in `docker inspect <name> --format '{{.State.OOMKilled}}'`. Images are pinned to a
version (Postgres `0.8.7-pg18`, Node with digest in the [Dockerfile](../Dockerfile), Caddy, SeaweedFS); an update is
a deliberate step, not something picked up on the next deploy.

To watch after the first run: whether 4 GB RAM is enough (`docker stats`, swap with `free -h`). Per
rule 7 in [AGENTS.md](../AGENTS.md) the logs contain only IDs, lengths, durations and token counts, no document content. Docker rotates them
(10 MB each, 3 files). Every request carries an ID (`X-Request-Id`, in Caddy's access log and in every log line of the app); an
error message in the browser shows the first eight characters as "Referenz" (reference). The logs of a container are lost with the container,
that is, on every deploy. Unexpected errors go to Sentry (EU) as soon as `SENTRY_DSN` is in `server.env`; what is sent and what is not is in [PLAN.md](PLAN.md#operations-and-quality-tools).

### Backup and restore

- `backup.sh` writes to `/srv/nlm/backups/nlm-<date>.sql.gz` (errors go to `/srv/nlm/backup.log`). The database is
  backed up. **The cover images (volume `s3data`) and `server.env` are not in the backup**; a copy of `server.env`
  belongs in your password manager. The dumps sit on the same server: against the loss of the server they help only
  if you download them now and then (`scp deploy@<hostname>:/srv/nlm/backups/<file> .`).
- Before every deploy the workflow takes a fresh dump (same file name as the nightly one, it replaces that of the day).
  If the dump fails, nothing is deployed.
- Whether a dump can be restored is checked by [restore-check.sh](../deploy/restore-check.sh) in a
  throwaway database (needs Docker, changes nothing in the real one): `deploy/restore-check.sh nlm-<date>.sql.gz` lists the
  tables with row counts and ends with "Restore OK". A broken dump aborts with an error. Run it once a month with
  a downloaded dump.
- Restore into an empty database:

  ```bash
  dc stop app
  dc exec -T db psql -U nlm -d postgres -c 'DROP DATABASE nlm' -c 'CREATE DATABASE nlm'
  gunzip -c backups/nlm-<date>.sql.gz | dc exec -T db psql -U nlm -d nlm
  dc start app
  ```

### Row-level security (role `nlm_app`)

The app connects as `nlm_app`, which does not own the tables; Postgres filters every row there by the user
(`DATABASE_URL`). Migrations, guests, sweeps and ingestion run through the owner `nlm` (`DATABASE_OWNER_URL`, set by
[docker-compose.prod.yml](../deploy/docker-compose.prod.yml)). `bootstrap.sh` creates `APP_DB_USER` and `APP_DB_PASSWORD` in
`server.env`; [app-role.sh](../deploy/app-role.sh) gives the role its password during the deploy. An existing server switches over
as soon as both lines are in `server.env` (`APP_DB_USER=nlm_app`, `APP_DB_PASSWORD=<random value>`). To go back: remove both lines
and run `dc up -d app`.

### Back to the previous version

Every deploy keeps the previous image as `nlm-app:previous`. After the start the workflow calls `https://<hostname>/health` from outside (DNS, certificate, Caddy, app). If the new
version does not start or does not answer, the step "Roll back" sets `previous` back to `current` automatically; the run stays
red. By hand, on the server:

```bash
docker tag nlm-app:previous nlm-app:current
dc up -d
```

The database migrations run forward when the app starts and are not undone; a rollback across
several versions with a schema change therefore needs the backup (see above).

### Certificate and hostname

Caddy fetches the certificate on first start and renews it itself; it lives in the volume `caddy_data`. With `sslip.io`
the Let's Encrypt limits for the shared domain name can apply; Caddy then falls back to ZeroSSL automatically. If that does
not help, use an own domain (change only `SITE_ADDRESS` in `server.env` and `DEPLOY_HOST`). Changing the hostname
needs a new deploy (`BETTER_AUTH_URL` is built from `SITE_ADDRESS`).

## Troubleshooting

| Observation                                              | Likely cause and step                                                                                           |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Deploy aborts at `ssh`                                   | `DEPLOY_KNOWN_HOSTS` or `DEPLOY_SSH_KEY` wrong; firewall does not allow port 22                                 |
| `up --wait` reports `app` as unhealthy                   | `dc logs app`: usually a `FILL_IN` or a missing value in `server.env` (the app checks the environment on start) |
| Browser reports a certificate error                      | `dc logs caddy`: ports 80 and 443 open? Hostname points to the IP? Limits see above                             |
| "Demo ausprobieren" (try the demo) answers with an error | `SEED_DEMO_EMAIL` is missing or `pnpm seed:demo` was not run                                                    |
| Cover images missing after a server restart              | Volume `s3data` deleted? It is not in the backup; upload the images again                                       |
| Server sluggish, container killed                        | `docker stats`, `free -h`: memory is tight; choose a larger server or check swap                                |
