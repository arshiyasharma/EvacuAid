#!/usr/bin/env bash
# evacuid.us → Caddy on the Vultr server → this tunnel → the app on this laptop (port 3000).
# One app, one data folder, Photon answered here. Keep this running (it reconnects on its own).
#   deploy/tunnel.sh            (uses the `evacuaid` host from ~/.ssh/config)
HOST="${DEPLOY_HOST:-evacuaid}"
while true; do
  echo "$(date '+%H:%M:%S') connecting tunnel to $HOST..."
  ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -R 127.0.0.1:3000:127.0.0.1:3000 "$HOST"
  echo "$(date '+%H:%M:%S') tunnel dropped; reconnecting in 3 s"
  sleep 3
done
