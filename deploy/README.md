# Deploying EvacuAid (live at evacuid.us)

## How it runs right now: tunnel mode

```
browser → https://evacuid.us → Caddy on Vultr (HTTPS, firewall) → SSH tunnel → this laptop's app (port 3000)
```

- The laptop runs the one live app: `bun run dev` (Terminal tab "EvacuAid app"), Photon on, data in `data/`.
- `deploy/tunnel.sh` (Terminal tab "evacuid.us tunnel") carries evacuid.us to it and reconnects on its own.
- **Code changes are live as soon as you save.** Nothing to push. Check on localhost, and evacuid.us shows the same.
- Keep the laptop awake and online (plugged in; `caffeinate -dims` in a spare tab stops it sleeping).
- If the laptop restarts: open two tabs and run `bun run dev` and `deploy/tunnel.sh` again.
- The server also has a full standby copy of the app (stopped). `deploy/deploy.sh` refuses to run in tunnel mode,
  so two copies can never answer texts. To move the night to the server: stop both tabs, then
  `DEPLOY_HOST=evacuaid deploy/switch-to-server.sh`. To come back: `DEPLOY_HOST=evacuaid deploy/switch-to-laptop.sh`.

The rest of this file is the server-only mode.

One always-on server (Vultr), the same `next start` as a local production build, the same data folder.
The server is a copy of the laptop, not a new setup: nothing is created fresh.

## Does it redeploy on every code change?

No. Nothing changes on the live site until you run `deploy/deploy.sh`. That's on purpose: a half-finished edit
can never reach judges. One command does it, and it only switches if every check passes (otherwise it rolls back).
**Freeze deploys during judging.**

## Every service: what it needs, and what changes for the server

Checked against the code, not assumed. Every service is reached by the app calling **out** over HTTPS (or
Postgres over TLS). **No service calls in**: there are no webhooks to register anywhere.

| Service | How the app talks to it | Key (in `.env.local`, copied by first-sync) | Change anything in their dashboard? |
|---|---|---|---|
| Photon (iMessage) | Polls for new texts every 2 s; sends with the same API | `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `PHOTON_AGENT_HANDLE` | **No.** No webhook. Same project, same number |
| Gemini | Server calls Google with the key | `GEMINI_API_KEY` | No (unless you restricted the key by IP) |
| Nessie | Server calls the API with a bearer key | `NESSIE_API` | No. Accounts are found via `data/nessie-state.json` |
| Solana devnet | Server signs with the keypair, public devnet RPC | keypair file (first-sync copies it), optional `SOLANA_RPC_URL` | No. Program and pool are found via `data/solana-state.json` |
| Tiger Data | Postgres connection, TLS required | `TIGER_DATABASE_URL` | **Only if** your service has an IP allow list: add the server IP |
| MapTiler | The **browser** loads map tiles with a public key | `NEXT_PUBLIC_MAPTILER_KEY` (baked in at build) | **Yes, if** the key has allowed origins: add `https://evacuaid.us` |
| NASA FIRMS | Only the data scripts; the fire is already in the code | `FIRMS_MAP_KEY` | No |
| Operator login | Signed cookie | `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | n/a. Secure cookie needs HTTPS (Caddy does it) |

## One live copy at a time, and the laptop is always the fallback

Photon only lets you *read* messages; if two copies read, both reply. So exactly one copy is live:

- **Server live:** laptop has `PHOTON_DISABLED=1` in `.env.local`. The laptop still runs everything else for development.
  The server never has that flag.
- **Server in trouble:** `deploy/switch-to-laptop.sh` stops the server, copies the server's data down (phones,
  conversations, ledger, runs), turns Photon back on locally. Restart `bun run dev`. Texts are answered by the laptop
  within 2 seconds, and no phone has to re-text first (conversations are saved in `data/photon-routes.json`).
- **Back to the server:** stop `bun run dev`, then `deploy/switch-to-server.sh` (copies data up, starts it, smoke-tests).

## Before you start (once)

1. **SSH key.** Vultr dashboard → your server → copy the root password, then from the laptop:
   `ssh-copy-id root@SERVER_IP` (paste the password once). Check: `ssh root@SERVER_IP echo ok`.
2. **DNS** wherever evacuaid.us is managed: `A @ → SERVER_IP` and `A www → SERVER_IP`. Remove any parking records.
   Check: `dig +short evacuaid.us` prints the IP.
3. **MapTiler** (cloud.maptiler.com → your key → allowed origins): add `https://evacuaid.us` and `https://www.evacuaid.us`,
   or the maps go blank.
4. **Tiger Data**: if the service has an IP allow list, add SERVER_IP.

## Deploy (first time, ~1 hour)

```bash
export DEPLOY_HOST=root@SERVER_IP
scp deploy/setup-server.sh $DEPLOY_HOST:/root/ && ssh $DEPLOY_HOST 'bash /root/setup-server.sh evacuaid.us'
deploy/first-sync.sh        # secrets, Solana keypair, data (phones, Nessie IDs, pool, runs)
echo PHOTON_DISABLED=1 >> .env.local   # the laptop stops answering texts: only the server does now
deploy/deploy.sh            # checks → build → switch → smoke test → (rollback if anything fails)
```

Restart your local dev server after adding `PHOTON_DISABLED=1`, or both copies reply to every text.

## Every later change

```bash
DEPLOY_HOST=root@SERVER_IP deploy/deploy.sh
```

## What protects what

| Risk | Protection |
|---|---|
| Build breaks | Built in a new release folder; the live one keeps running until the build passes |
| Something breaks after the switch | `scripts/smoke.ts` checks every page and API on https://evacuaid.us; failure switches back automatically |
| Phones, ledger, runs lost | Data lives in `/srv/evacuaid/shared/data`, never uploaded over; backed up before every deploy and nightly (14 kept) |
| Server restarts mid-trip | Trips resume on startup (van outside → on board → checked in) |
| App crashes | systemd restarts it in 2 s |
| Double replies to texts | Only one copy polls Photon: the laptop has `PHOTON_DISABLED=1` |
| New Nessie accounts / new pool by accident | `nessie-state.json` and `solana-state.json` come over in first-sync; `first-sync.sh` refuses to overwrite server data |
| Login fails on the real site | HTTPS via Caddy, so the secure session cookie works |

## Verified locally (production build, Photon off)

`next build` passes; `bun scripts/smoke.ts http://127.0.0.1:3100 --write` passed every check except Photon
(switched off on purpose): all pages, Nessie fund + ops + bridge, Solana pool, Tiger metrics, Gemini reply,
all 12 operator routes locked, public routes reject bad input.

## Rehearsal on the live site (do all of it, the day before)

```bash
bun scripts/smoke.ts https://evacuaid.us
SMOKE_USER=… SMOKE_PASS=… bun scripts/smoke.ts https://evacuaid.us --operator
```

Then by hand, with a real phone:

1. Sign up on evacuaid.us → the QR / "Text EVAC" opens Messages to the Photon number.
2. Text EVAC → reply 3 → A. The case appears in /console.
3. Sign in at /login, dispatch a van → resident gets "dispatched", "outside", "on board", "checked in".
4. Mid-trip: `ssh $DEPLOY_HOST systemctl restart evacuaid` → the trip still finishes.
5. Approve aid → Nessie transfer, Solana release, bridge deposit, card swipe on /relief; Tiger charts move.
6. Donate on /donate → devnet transaction → receipt names the family.
7. Reset the drill → History shows the old run; real phones still on the roster.
8. Text STOP → phone toggled off, not removed.
9. Click every link on /pitch, including "Sign up →" under Demo time.

## If something goes wrong

- Logs: `ssh $DEPLOY_HOST journalctl -u evacuaid -n 200 -f`
- Go back one release: `ssh $DEPLOY_HOST 'ls -1t /srv/evacuaid/releases'`, then
  `ln -sfn /srv/evacuaid/releases/OLDER /srv/evacuaid/current && systemctl restart evacuaid`
- Restore data: `tar -xzf /srv/evacuaid/backups/predeploy-….tgz -C /srv/evacuaid/shared`
- Last resort: remove `PHOTON_DISABLED=1` locally and run the laptop (it has the same app).
