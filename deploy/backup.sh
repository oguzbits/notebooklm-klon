#!/usr/bin/env bash
# Daily dump of the database (cron, see bootstrap.sh). Keeps the last 7 dumps. The cover images in
# the s3data volume are not part of it.
set -euo pipefail

cd /srv/nlm
mkdir -p backups
target="backups/nlm-$(date +%F).sql.gz"

docker compose -f docker-compose.prod.yml --env-file server.env exec -T db pg_dump -U nlm nlm | gzip > "$target.tmp"
mv "$target.tmp" "$target"

find backups -name 'nlm-*.sql.gz' -mtime +7 -delete
