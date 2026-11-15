#!/usr/bin/env bash
# One time, ON THE SERVER (Ubuntu): installs Node, Bun, Caddy, the service and the firewall.
#   scp deploy/setup-server.sh root@SERVER:/root/ && ssh root@SERVER 'bash /root/setup-server.sh evacuaid.us'
set -euo pipefail
DOMAIN="${1:-evacuaid.us}"
APP=/srv/evacuaid

apt-get update -y
apt-get install -y curl git rsync unzip ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https ufw

# Node 22 (Next 16 needs Node 20.9+)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# Bun (installs packages from bun.lock exactly as on the laptop)
id evacuaid >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash evacuaid
sudo -u evacuaid bash -c 'command -v ~/.bun/bin/bun >/dev/null || curl -fsSL https://bun.sh/install | bash'

# Caddy: HTTPS certificates on its own
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

mkdir -p "$APP/releases" "$APP/shared/data" "$APP/shared/keys" "$APP/backups"
chown -R evacuaid:evacuaid "$APP"
chmod 700 "$APP/shared" "$APP/shared/keys"

cat > /etc/systemd/system/evacuaid.service <<UNIT
[Unit]
Description=EvacuAid
After=network-online.target
Wants=network-online.target

[Service]
User=evacuaid
WorkingDirectory=$APP/current
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN, www.$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY

# Nightly backup of the night's data (keeps 14)
cat > /etc/cron.daily/evacuaid-backup <<'CRON'
#!/bin/sh
tar -czf /srv/evacuaid/backups/data-$(date +%F).tgz -C /srv/evacuaid/shared data
ls -1t /srv/evacuaid/backups/data-*.tgz | tail -n +15 | xargs -r rm
CRON
chmod +x /etc/cron.daily/evacuaid-backup

ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
systemctl daemon-reload
systemctl enable evacuaid caddy
systemctl restart caddy
echo "Server ready. Next, from the laptop: deploy/first-sync.sh, then deploy/deploy.sh"
