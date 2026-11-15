# EvacuAid

**When the evacuation alert goes out, EvacuAid finds who can't leave and gets them out first.**

Alerts are one-way. EvacuAid turns every alert into a two-way roll call over plain SMS, understands replies in any language with Gemini, ranks who can't get out, dispatches vehicles, and pays people to leave through a fraud-checked bank layer on Capital One's Nessie.

Built solo at HackUMass XIV.

## Run it

```bash
bun install
cp .env.example .env.local   # add your keys
bun run dev                  # http://localhost:3000
```

- `/` — landing page
- `/console` — operator console: Eaton fire replay, live map, priority queue, money
- `/phone` — web phone that texts EvacuAid through the same pipeline as SMS

Tests: `bun run test`. Key check: `bun --env-file=.env.local scripts/check-keys.ts`.

## How it works

1. **Hazard** — the 2025 Eaton fire replayed from NASA FIRMS satellite detections (`scripts/build_eaton.py`).
2. **Roll call** — households get *"Reply 1 I'm out, 2 leaving now, 3 I need help"*; real phones over iMessage (Photon) or the web phone.
3. **Triage** — Gemini turns any reply into status + needs + a reply in the resident's language; keyword rules as fallback.
4. **Priority** — `P(fire within 2 h) × vulnerability × (1 − ability to leave)`, every score with its reasons.
5. **Dispatch** — nearest vehicle with seats, wheelchair-capable when needed; residents get an ETA text.
6. **Money** — $770 stipend from the county relief fund to a restricted relief card, after five fraud checks on banking data (Nessie).
7. **Forecast** — Monte Carlo of relief money needed over the next hours vs. what's available.

## Stack

Next.js 16 · React 19 · Tailwind 4 · MapLibre + MapTiler · Gemini API · Capital One Nessie v2 · Photon (iMessage) · Tiger Data · Vultr · Solana (devnet)

Fire data: NASA FIRMS (VIIRS, MODIS). All residents in the replay are fictional; streets are real.
