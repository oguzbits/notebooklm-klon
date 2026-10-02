#!/usr/bin/env bash
# Sets up a freshly booked Ubuntu 24.04 server for the deploy workflow, from your own machine:
#   deploy/provision.sh <IPv4 or host name>
# It makes a new deploy key, runs bootstrap.sh on the server, fills server.env from .env.local and
# sets the three GitHub secrets with `gh`. It prints no secret; the model values and the Gemini key
# travel over SSH stdin only. Needs: ssh access as root by your own key, `gh auth login`, .env.local.
# Safe to run again: it makes a new deploy key and replaces the old one on the server and in GitHub;
# server.env keeps every value that is already filled in.
set -euo pipefail

target="${1:?usage: deploy/provision.sh <IPv4 or host name>}"
cd "$(dirname "$0")/.."

# 203.0.113.7 becomes 203-0-113-7.sslip.io; anything else is taken as a host name.
if [[ "$target" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then host="${target//./-}.sslip.io"; else host="$target"; fi

env_file=.env.local
[ -f "$env_file" ] || { echo "$env_file missing" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
. "./$env_file"
set +a
for name in GEMINI_API_KEY AI_MODEL PARSE_MODEL EMBEDDING_MODEL; do
  [ -n "${!name:-}" ] || { echo "$name is empty in $env_file" >&2; exit 1; }
done
demo_email="${SEED_DEMO_EMAIL:-}"
[ -n "$demo_email" ] || read -r -p "E-Mail-Adresse für das Demo-Konto (SEED_DEMO_EMAIL): " demo_email
[ -n "$demo_email" ] || { echo "SEED_DEMO_EMAIL is empty" >&2; exit 1; }
gh auth status >/dev/null

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Pin the host key before any login, and let the person compare it with the Hetzner console.
ssh-keyscan -t ed25519 "$host" 2>/dev/null > "$work/known_hosts"
[ -s "$work/known_hosts" ] || { echo "No answer from $host on port 22" >&2; exit 1; }
echo "Fingerabdruck des Servers $host:"
ssh-keygen -lf "$work/known_hosts"
read -r -p "Stimmt er mit der Hetzner-Konsole überein (Server > Übersicht)? [j/N] " ok
[ "$ok" = "j" ] || { echo "Abgebrochen." >&2; exit 1; }

ssh_opts=(-o "UserKnownHostsFile=$work/known_hosts" -o StrictHostKeyChecking=yes)
root="root@$host"

ssh-keygen -q -t ed25519 -N "" -C "nlm-deploy" -f "$work/deploy_key"

scp "${ssh_opts[@]}" deploy/bootstrap.sh "$root:/root/bootstrap.sh"
ssh "${ssh_opts[@]}" "$root" bash /root/bootstrap.sh "$host" "'$(cat "$work/deploy_key.pub")'"

# Fill only the FILL_IN lines, so a second run never overwrites a value that is already set.
# An unset optional model removes its line; the Tavily key is appended when present.
{
  printf 'GEMINI_API_KEY=%s\nAI_MODEL=%s\nPARSE_MODEL=%s\nEMBEDDING_MODEL=%s\nSEED_DEMO_EMAIL=%s\n' \
    "$GEMINI_API_KEY" "$AI_MODEL" "$PARSE_MODEL" "$EMBEDDING_MODEL" "$demo_email"
  [ -z "${PARSE_FALLBACK_MODEL:-}" ] || printf 'PARSE_FALLBACK_MODEL=%s\n' "$PARSE_FALLBACK_MODEL"
  [ -z "${TAVILY_API_KEY:-}" ] || printf 'TAVILY_API_KEY=%s\n' "$TAVILY_API_KEY"
} | ssh "${ssh_opts[@]}" "$root" '
  set -euo pipefail
  umask 077
  env=/srv/nlm/server.env
  values=$(mktemp)
  merged=$(mktemp)
  trap "rm -f $values $merged" EXIT
  cat > "$values"
  awk "
    NR == FNR { v[substr(\$0, 1, index(\$0, \"=\") - 1)] = substr(\$0, index(\$0, \"=\") + 1); next }
    /=FILL_IN\$/ { k = substr(\$0, 1, index(\$0, \"=\") - 1); if (k in v) print k \"=\" v[k]; next }
    { print }
  " "$values" "$env" > "$merged"
  grep -q "^TAVILY_API_KEY=" "$merged" || grep "^TAVILY_API_KEY=" "$values" >> "$merged" || true
  cat "$merged" > "$env"
  if grep -q FILL_IN "$env"; then echo "server.env still has FILL_IN" >&2; exit 1; fi
'

# The deploy user must be able to log in with the new key before the secrets go to GitHub.
ssh "${ssh_opts[@]}" -i "$work/deploy_key" -o IdentitiesOnly=yes "deploy@$host" true

gh secret set DEPLOY_HOST --body "$host"
gh secret set DEPLOY_SSH_KEY < "$work/deploy_key"
gh secret set DEPLOY_KNOWN_HOSTS < "$work/known_hosts"

echo
echo "Fertig. Server $host ist eingerichtet, die drei GitHub-Secrets sind gesetzt."
echo "Nächster Schritt: Merge auf main (Deploy läuft danach automatisch) oder Actions > Deploy > Run workflow."
