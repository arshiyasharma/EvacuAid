#!/usr/bin/env bash
# Make the SERVER live again after the laptop was (the reverse of switch-to-laptop.sh).
#   DEPLOY_HOST=root@SERVER deploy/switch-to-server.sh
# Stop `bun run dev` first, so only one copy answers texts.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:?set DEPLOY_HOST=root@your-server}"
APP=/srv/evacuaid

grep -q '^PHOTON_DISABLED=1' .env.local || echo "PHOTON_DISABLED=1" >> .env.local
ssh "$HOST" "tar -czf $APP/backups/server-data-before-switch-$(date +%Y%m%d-%H%M%S).tgz -C $APP/shared data"
rsync -a --delete data/ "$HOST:$APP/shared/data/"
ssh "$HOST" "chown -R evacuaid:evacuaid $APP/shared/data && systemctl enable --now evacuaid"
for i in $(seq 1 30); do curl -fsS -o /dev/null "https://${DOMAIN:-evacuid.us}/api/live" && break; sleep 2; done
bun scripts/smoke.ts "https://${DOMAIN:-evacuid.us}"
echo "Server is live. The laptop won't answer texts (PHOTON_DISABLED=1) until you switch back."
