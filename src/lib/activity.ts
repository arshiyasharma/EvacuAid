// Every real transaction, as it happens, labeled by the system that did it.
// The relief page streams this so judges can watch Nessie and Solana work live.
// Saved to disk, so a server restart never erases it. Each drill is a run:
// resetting starts a new run, and earlier runs move to History.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tigerEvent, type TigerKind } from "./tiger";

export type Activity = {
  id: string;
  at: number;
  run: number;
  system: "nessie" | "solana" | "evacuaid";
  /** Short verb phrase: "Aid created", "Bank checks passed", "Released from donor pool"… */
  what: string;
  /** Who/what it was for, never a real resident's name. */
  detail: string;
  cents?: number;
  tone?: "ok" | "warn" | "bad" | "info";
  /** Nessie transaction id or Solana signature. */
  ref?: string;
  link?: string;
};

type Saved = { run: number; runStartedAt: Record<number, number>; items: Activity[] };

const FILE = "data/activity.json";
const MAX = 1500;
const g = globalThis as unknown as { __evacuaidActivity?: Saved };

function state(): Saved {
  if (!g.__evacuaidActivity) {
    let s: Saved = { run: 1, runStartedAt: { 1: Date.now() }, items: [] };
    try {
      if (existsSync(FILE)) {
        const j = JSON.parse(readFileSync(FILE, "utf8"));
        // Older files were a bare list: treat them as run 1.
        s = Array.isArray(j) ? { run: 1, runStartedAt: { 1: j.at(-1)?.at ?? Date.now() }, items: j.map((a: Activity) => ({ ...a, run: a.run ?? 1 })) } : j;
      }
    } catch {
      // start clean
    }
    g.__evacuaidActivity = s;
  }
  return g.__evacuaidActivity;
}

function save() {
  try {
    mkdirSync("data", { recursive: true });
    writeFileSync(FILE, JSON.stringify(state()));
  } catch {
    // read-only disk: keep it in memory
  }
}

/** The Tiger Data kind for a logged transaction. */
function kindOf(a: Pick<Activity, "system" | "what">): TigerKind {
  const w = a.what;
  if (a.system === "solana") return w.startsWith("Gift") ? "solana_gift" : w.startsWith("Released") ? "solana_release" : "solana_refused";
  if (w.startsWith("Aid transfer created")) return "aid_created";
  if (w.startsWith("Five bank checks passed") || w.startsWith("Approved by the operator")) return "aid_approved";
  if (w.startsWith("Held")) return "aid_held";
  if (w.startsWith("Blocked") || w.startsWith("Declined by")) return "aid_blocked";
  if (w.startsWith("Settled")) return "aid_settled";
  if (w.startsWith("Relief card purchase approved")) return "card_ok";
  if (w.startsWith("Relief card purchase declined")) return "card_declined";
  if (w.startsWith("Rescue trip billed")) return "trip_billed";
  return "drill";
}

let n = 0;
export function logActivity(a: Omit<Activity, "id" | "at" | "run"> & { at?: number }) {
  const s = state();
  const item = { id: `${Date.now().toString(36)}-${(n++).toString(36)}`, at: a.at ?? Date.now(), run: s.run, ...a };
  s.items.unshift(item);
  if (s.items.length > MAX) s.items.length = MAX;
  save();
  tigerEvent({ kind: kindOf(item), run: item.run, system: item.system, cents: item.cents, detail: `${item.what} · ${item.detail}`, ref: item.ref, at: item.at });
}

export const currentRun = () => state().run;

/** Start a new drill run; everything before it becomes History. */
export function startNewRun() {
  const s = state();
  s.run += 1;
  s.runStartedAt[s.run] = Date.now();
  save();
  return s.run;
}

/** The current run only: what the front pages show. */
export function recentActivity(limit = 60) {
  const s = state();
  return s.items.filter((a) => a.run === s.run).slice(0, limit);
}

/** Earlier runs, newest first, with totals that only count real money moves. */
export function activityHistory() {
  const s = state();
  const runs = new Map<number, Activity[]>();
  for (const a of s.items) if (a.run !== s.run) runs.set(a.run, [...(runs.get(a.run) ?? []), a]);
  return [...runs.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([run, items]) => ({
      run,
      startedAt: s.runStartedAt[run] ?? items.at(-1)?.at ?? 0,
      endedAt: items[0]?.at ?? 0,
      approvedCents: items.filter((i) => i.what.startsWith("Five bank checks passed") || i.what.startsWith("Approved by the operator")).reduce((t, i) => t + (i.cents ?? 0), 0),
      releasedCents: items.filter((i) => i.system === "solana" && i.what.startsWith("Released")).reduce((t, i) => t + (i.cents ?? 0), 0),
      donatedCents: items.filter((i) => i.system === "solana" && i.what.startsWith("Gift")).reduce((t, i) => t + (i.cents ?? 0), 0),
      blocked: items.filter((i) => i.what.startsWith("Blocked")).length,
      items,
    }));
}

export const solanaLink = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
