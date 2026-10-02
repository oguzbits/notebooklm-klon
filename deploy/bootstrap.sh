#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server, run as root:
#   bash bootstrap.sh <host name> "<public SSH key of the deploy user>"
# for example: bash bootstrap.sh 203-0-113-7.sslip.io "ssh-ed25519 AAAA... deploy"
# Installs Docker, makes the user "deploy", adds swap and the nightly backup, and writes
# /srv/nlm/server.env with fresh secrets. It prints no secret. Safe to run again: an existing
# server.env is kept.
set -euo pipefail

host="${1:?host name missing}"
public_key="${2:?public SSH key missing}"
app_dir=/srv/nlm

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y docker.io docker-compose-v2 ufw unattended-upgrades cron openssl

# Swap: a build or a migration must not end in the OOM killer on a 4 GB machine.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# The deploy user: may run docker, logs in by key only.
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos '' deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
echo "$public_key" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
cat > /etc/ssh/sshd_config.d/10-nlm.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
systemctl reload ssh

# Firewall (the Hetzner firewall should say the same).
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

install -d -o deploy -g deploy "$app_dir"

if [ ! -f "$app_dir/server.env" ]; then
  # The two placeholders are filled in by hand: nano /srv/nlm/server.env
  {
    echo "SITE_ADDRESS=$host"
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
    echo "S3_ACCESS_KEY_ID=$(openssl rand -hex 12)"
    echo "S3_SECRET_ACCESS_KEY=$(openssl rand -hex 24)"
    echo "GEMINI_API_KEY=FILL_IN"
    echo "AI_MODEL=FILL_IN"
    echo "PARSE_MODEL=FILL_IN"
    echo "PARSE_FALLBACK_MODEL=FILL_IN"
    echo "EMBEDDING_MODEL=FILL_IN"
    echo "SEED_DEMO_EMAIL=FILL_IN"
  } > "$app_dir/server.env"
  chown deploy:deploy "$app_dir/server.env"
  chmod 600 "$app_dir/server.env"
fi

# The S3 store reads its identity from a file made from the same two values.
set -a
# shellcheck disable=SC1091
. "$app_dir/server.env"
set +a
cat > "$app_dir/s3.json" <<EOF
{
  "identities": [
    {
      "name": "app",
      "credentials": [{ "accessKey": "$S3_ACCESS_KEY_ID", "secretKey": "$S3_SECRET_ACCESS_KEY" }],
      "actions": ["Admin", "Read", "Write", "List", "Tagging"]
    }
  ]
}
EOF
chown deploy:deploy "$app_dir/s3.json"
chmod 600 "$app_dir/s3.json"

# Nightly dump at 03:15. The deploy workflow copies backup.sh to $app_dir.
echo '15 3 * * * deploy /srv/nlm/backup.sh >> /srv/nlm/backup.log 2>&1' > /etc/cron.d/nlm-backup
chmod 644 /etc/cron.d/nlm-backup

echo "Done. Next: fill in the FILL_IN values in $app_dir/server.env, then push to main."
