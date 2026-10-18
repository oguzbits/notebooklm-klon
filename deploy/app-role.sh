#!/usr/bin/env bash
# Gives the app role its login and password (docs/DEPLOYMENT.md). The role is created by a migration
# without login; this runs before the new app connects. Does nothing while server.env has no
# APP_DB_PASSWORD. Safe to repeat.
set -euo pipefail
cd /srv/nlm

password=$(grep '^APP_DB_PASSWORD=' server.env | cut -d= -f2- || true)
[ -n "$password" ] || exit 0

docker compose -f docker-compose.prod.yml --env-file server.env up -d --wait db
# psql quotes :'pw' itself; the password never appears in a process list or a log.
docker compose -f docker-compose.prod.yml --env-file server.env exec -T db \
  psql -U nlm -d nlm -v ON_ERROR_STOP=1 -q -v pw="$password" <<'SQL'
SELECT 'CREATE ROLE nlm_app NOLOGIN NOBYPASSRLS' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nlm_app') \gexec
ALTER ROLE nlm_app LOGIN PASSWORD :'pw';
SQL
