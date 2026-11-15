// Wipes the Nessie sandbox for this key and rebuilds the county bank and merchants.
// Run before a demo: bun --env-file=.env.local scripts/nessie-reset.ts
import { rmSync } from "node:fs";
import { ensureBank } from "../src/lib/bank/nessie";

const res = await fetch(`${process.env.NESSIE_BASE_URL || "https://v2-prod-api.nessieisreal.com"}/data`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${process.env.NESSIE_API}` },
});
console.log("cleared sandbox:", res.status, await res.text());
rmSync("data/nessie-state.json", { force: true });
const s = await ensureBank();
console.log("county relief fund:", s.reliefFundId, "| merchants:", Object.keys(s.merchants).length);
console.log("Restart the dev server so it forgets the old ids.");
