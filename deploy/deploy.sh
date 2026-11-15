#!/usr/bin/env bash
# Every code change, FROM THE LAPTOP. The live site only switches if everything passes:
#   1. checks on the laptop (types, lint, tests)
#   2. upload into a NEW release folder (the live one is untouched)
#   3. install + production build there (fails? stop; live site never noticed)
#   4. back up the data, switch to the new release, restart
#   5. smoke-test every page and API on the real domain
#   6. any failure → switch back to the previous release automatically
# Data (phones, ledger, runs) lives outside releases and is never uploaded or replaced.
#   DEPLOY_HOST=root@SERVER deploy/deploy.sh            (DOMAIN defaults to evacuaid.us)
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:?set DEPLOY_HOST=root@your-server}"
DOMAIN="${DOMAIN:-evacuid.us}"
APP=/srv/evacuaid
REL=$(date +%Y%m%d-%H%M%S)
# --standby: refresh the server's stopped copy (build + point to it) without starting it.
# Safe in tunnel mode: nothing on the server answers texts.
STANDBY=0; [ "${1:-}" = "--standby" ] && STANDBY=1
# Tunnel mode: the laptop is the live app (evacuid.us is tunnelled to it). Starting the
# server's own copy would mean two apps answering texts, so refuse until you switch.
if [ $STANDBY = 0 ] && ! grep -q '^PHOTON_DISABLED=1' .env.local; then
  echo "The laptop is the live app right now (tunnel mode). Nothing to deploy: your local changes are already live."
  echo "To refresh the server's standby copy: deploy/deploy.sh --standby"
  echo "To make the server run its own copy instead: stop deploy/tunnel.sh and bun run dev, then deploy/switch-to-server.sh."
  exit 1
fi
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

step "1/6 Checks on the laptop"
npx tsc --noEmit -p . 2>&1 | grep -v '^\.next/' | grep . && { echo "Type errors"; exit 1; } || true
npx eslint . >/dev/null || { npx eslint .; exit 1; }
bunx vitest run >/dev/null || { bunx vitest run; exit 1; }

step "2/6 Upload to release $REL"
rsync -az --delete \
  --exclude /node_modules --exclude /.next --exclude /data --exclude /backups --exclude 'solana/target' \
  --exclude '.env*' --exclude .git --exclude private --exclude notes --exclude '*.private.md' \
  ./ "$HOST:$APP/releases/$REL/"

step "3/6 Install and build on the server"
ssh "$HOST" bash -s <<REMOTE
set -euo pipefail
cd $APP/releases/$REL
ln -sfn $APP/shared/.env .env.production.local
chown -R evacuaid:evacuaid $APP/releases/$REL
sudo -u evacuaid bash -lc 'cd $APP/releases/$REL && ~/.bun/bin/bun install --frozen-lockfile && NEXT_TELEMETRY_DISABLED=1 NODE_ENV=production node node_modules/next/dist/bin/next build'
# The data folder is linked in only after the build: the bundler won't follow links outside the project.
rm -rf data && ln -s $APP/shared/data data
chown -h evacuaid:evacuaid data
REMOTE

if [ $STANDBY = 1 ]; then
  ssh "$HOST" "ln -sfn $APP/releases/$REL $APP/current && cd $APP/releases && ls -1t | tail -n +4 | xargs -r rm -rf"
  step "Standby updated to release $REL (not started; evacuid.us still runs from the laptop)"
  exit 0
fi

step "4/6 Back up data, switch, restart"
PREV=$(ssh "$HOST" "readlink $APP/current || true")
ssh "$HOST" "tar -czf $APP/backups/predeploy-$REL.tgz -C $APP/shared data && ln -sfn $APP/releases/$REL $APP/current && systemctl restart evacuaid"
for i in $(seq 1 30); do curl -fsS -o /dev/null "https://$DOMAIN/api/live" && break; sleep 2; done

step "5/6 Smoke test https://$DOMAIN"
if bun scripts/smoke.ts "https://$DOMAIN"; then
  ssh "$HOST" "cd $APP/releases && ls -1t | tail -n +4 | xargs -r rm -rf"
  step "6/6 Live: https://$DOMAIN (release $REL)"
else
  step "6/6 Smoke test failed: rolling back"
  if [ -n "$PREV" ]; then
    ssh "$HOST" "ln -sfn $PREV $APP/current && systemctl restart evacuaid"
    echo "Back on $(basename "$PREV"). Logs: ssh $HOST journalctl -u evacuaid -n 100"
  else
    echo "No earlier release to go back to (first deploy). Logs: ssh $HOST journalctl -u evacuaid -n 100"
  fi
  exit 1
fi
