#!/usr/bin/env bash
# One time, FROM THE LAPTOP: copies secrets, the Solana keypair and the night's data
# to the server, so it starts exactly where the laptop is (same phones, same Nessie
# accounts, same pool, same runs). After this the SERVER's data is the truth.
#   DEPLOY_HOST=root@SERVER deploy/first-sync.sh
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${DEPLOY_HOST:?set DEPLOY_HOST=root@your-server}"
APP=/srv/evacuaid
KEY_LOCAL=$(grep -E '^SOLANA_KEYPAIR_PATH=' .env.local | cut -d= -f2- || true)
KEY_LOCAL="${KEY_LOCAL:-$HOME/.config/evacuaid/solana-devnet-keypair.json}"
KEY_LOCAL="${KEY_LOCAL/#\~/$HOME}"

if ssh "$HOST" "test -s $APP/shared/data/live-store.json" && [ "${1:-}" != "--force" ]; then
  echo "The server already has its own data. Refusing to overwrite it (pass --force if you really mean to)."
  exit 1
fi
[ -f .env.local ] || { echo "No .env.local"; exit 1; }
[ -f "$KEY_LOCAL" ] || { echo "No Solana keypair at $KEY_LOCAL"; exit 1; }

# Production env: the laptop's settings, with the keypair path moved and Photon on.
grep -v -E '^(SOLANA_KEYPAIR_PATH|PHOTON_DISABLED|NODE_ENV)=' .env.local > /tmp/evacuaid.env
echo "SOLANA_KEYPAIR_PATH=$APP/shared/keys/solana.json" >> /tmp/evacuaid.env
scp -q /tmp/evacuaid.env "$HOST:$APP/shared/.env" && rm /tmp/evacuaid.env
scp -q "$KEY_LOCAL" "$HOST:$APP/shared/keys/solana.json"
rsync -a --delete data/ "$HOST:$APP/shared/data/"
ssh "$HOST" "chown -R evacuaid:evacuaid $APP/shared && chmod 600 $APP/shared/.env $APP/shared/keys/solana.json"

echo "Synced. From now on keep the laptop from answering texts: add PHOTON_DISABLED=1 to .env.local."
