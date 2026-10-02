#!/usr/bin/env bash
# Proves a dump can be restored: loads it into a throwaway Postgres (same image as production) and
# lists the tables with their row counts. Needs Docker, touches nothing else. Usage:
#   deploy/restore-check.sh backups/nlm-2026-10-02.sql.gz
set -euo pipefail

dump="${1:?usage: restore-check.sh <dump.sql.gz>}"
image="pgvector/pgvector:pg18"
name="nlm-restore-check-$$"

docker run -d --rm --name "$name" -e POSTGRES_PASSWORD=check -e POSTGRES_USER=nlm -e POSTGRES_DB=nlm "$image" >/dev/null
trap 'docker stop "$name" >/dev/null' EXIT

# The image restarts once while it initialises, so wait until it answers on the final server.
until docker exec "$name" psql -U nlm -d nlm -tAc 'select 1' >/dev/null 2>&1; do sleep 1; done
sleep 2
until docker exec "$name" psql -U nlm -d nlm -tAc 'select 1' >/dev/null 2>&1; do sleep 1; done

gunzip -c "$dump" | docker exec -i "$name" psql -U nlm -d nlm -v ON_ERROR_STOP=1 -q >/dev/null

docker exec "$name" psql -U nlm -d nlm -tA -c "
  select format('%s: %s', relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', schemaname, relname), false, true, '')))[1])
  from pg_stat_user_tables order by relname"
echo "Restore OK: $dump"
