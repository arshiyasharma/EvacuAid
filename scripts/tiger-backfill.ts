// Create the Tiger Data schema and backfill tonight's saved activity, then read
// the continuous aggregate back.
//   bun --conditions=react-server --env-file=.env.local scripts/tiger-backfill.ts
import { existsSync, readFileSync } from "node:fs";
import { metrics, tigerEvent } from "../src/lib/tiger";

type A = { at: number; run?: number; system: string; what: string; detail: string; cents?: number; ref?: string };
const file = "data/activity.json";
const saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { items: [] };
const items: A[] = Array.isArray(saved) ? saved : saved.items;

const kindOf = (a: A) =>
  a.system === "solana"
    ? a.what.startsWith("Gift") ? "solana_gift" : a.what.startsWith("Released") ? "solana_release" : "solana_refused"
    : a.what.startsWith("Aid transfer created") ? "aid_created"
    : a.what.startsWith("Five bank checks passed") || a.what.startsWith("Approved by the operator") ? "aid_approved"
    : a.what.startsWith("Held") ? "aid_held"
    : a.what.startsWith("Blocked") ? "aid_blocked"
    : a.what.startsWith("Settled") ? "aid_settled"
    : a.what.startsWith("Relief card purchase approved") ? "card_ok"
    : a.what.startsWith("Relief card purchase declined") ? "card_declined"
    : a.what.startsWith("Rescue trip billed") ? "trip_billed"
    : "drill";

for (const a of items) {
  tigerEvent({ kind: kindOf(a) as never, run: a.run ?? 1, system: a.system, cents: a.cents, detail: `${a.what} · ${a.detail}`, ref: a.ref, at: a.at });
}
await new Promise((r) => setTimeout(r, 4000));
const m = await metrics(1);
console.log(`ok=${m.ok} rows=${m.rows} query=${m.ms}ms`);
console.log(m.totals);
process.exit(0);
