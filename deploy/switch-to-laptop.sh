#!/usr/bin/env bash
# Emergency: make the LAPTOP the live EvacuAid again, with everything the server knew.
#   DEPLOY_HOST=root@SERVER deploy/switch-to-laptop.sh
# 1. stops the server (so it stops answering texts)
# 2. copies the server's data down (phones, conversations, ledger, runs): nothing is lost
# 3. turns Photon back on locally
# Then restart `bun run dev`. Texts are answered by the laptop within 2 seconds.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:?set DEPLOY_HOST=root@your-server}"
APP=/srv/evacuaid

ssh "$HOST" "systemctl disable --now evacuaid" || echo "Couldn't reach the server to stop it. If it's still running, both will answer texts."
mkdir -p backups
tar -czf "backups/laptop-data-before-switch-$(date +%Y%m%d-%H%M%S).tgz" data
rsync -a --delete "$HOST:$APP/shared/data/" data/ || echo "Couldn't copy server data; using the laptop's own data."
sed -i '' '/^PHOTON_DISABLED=/d' .env.local
echo "Laptop is live. Restart the dev server now (Ctrl-C, then: bun run dev)."
