// Glue between households (live or simulated) and the Nessie bank layer.

import { aidDecidedLive, dispatchLive, findLive, operatorMessage, snapshot } from "../live/store";
import { opsSnapshot as opsActions, planTrip, recordBill, recordDispatch, recordMessage, resetOps } from "../ops/actions";
import { REPLAY_END, REPLAY_START } from "../replay/eaton";
import { householdsAt, SIM_EVENTS, SIM_HOUSEHOLDS } from "../replay/households";
import { AID_KINDS, type AidKind } from "../budget";
import { donations, poolSnapshot, releaseFor } from "../solana/pool";
import { currentRun, logActivity, solanaLink, startNewRun } from "../activity";
import { tigerEvent } from "../tiger";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PERSONA_CLAIMS, stipendEligibility } from "./eligibility";
import {
  billTrip,
  decideHeld,
  depositFromPool,
  fundSnapshot,
  opsSnapshot as opsFundSnapshot,
  reliefCardPurchase,
  requestStipend,
  transactionStatus,
  waitForSettled,
  type HouseholdProfile,
  type StipendOutcome,
} from "./nessie";

// A few simulated households are fraud personas, so the demo shows the check working.
const PERSONAS: Record<string, HouseholdProfile["history"]> = {
  h007: "vegas",
  h113: "vegas",
  h241: "vegas",
  h019: "commuter",
  h088: "commuter",
};

export type SpendEntry = {
  at: number;
  householdId: string;
  label: string;
  merchant: string;
  category: string;
  cents: number;
  approved: boolean;
  transactionId: string;
};

const gs = globalThis as unknown as { __evacuaidSpends?: SpendEntry[] };
const spends: SpendEntry[] = (gs.__evacuaidSpends ??= []);

/** One entry per payment (a household can get more than one, up to the cap). */
/** Where an approved payment's money came from: the donor pool on Solana, or the county fund. */
type Funding = { source: "solana" | "county"; status: "releasing" | "released" | "fallback"; sig?: string; error?: string };
type Entry = StipendOutcome & {
  at: number;
  householdId: string;
  label: string;
  kind: AidKind;
  funding?: Funding;
  /** Replay time the operator approved it (simulated residents). */
  replayAt?: number;
  override?: boolean;
};
type Ledger = Map<string, Entry>;

/**
 * Approved money is released from the Solana donor pool to the county's relief
 * account, tagged with this Nessie transaction. Runs in the background so the
 * operator never waits on the chain; if the pool can't pay, the county fund covers it.
 */
function fundFromPool(entry: Entry) {
  if (entry.decision !== "approved" || !entry.transactionId) return;
  entry.funding = { source: "solana", status: "releasing" };
  const who = publicLabel(entry);
  releaseFor(entry.householdId, entry.amountCents, entry.transactionId)
    .then((r) => {
      if (r.sig) {
        entry.funding = { source: "solana", status: "released", sig: r.sig };
        logActivity({ system: "solana", what: "Released from the donor pool", detail: `${who} · program checked order, cap and payout`, cents: entry.amountCents, tone: "ok", ref: r.sig, link: solanaLink(r.sig) });
        const sig = r.sig;
        depositFromPool(entry.amountCents, sig, who)
          .then((id) => id && logActivity({ system: "nessie", what: "County paid back by donors", detail: `${who} · Solana release deposited to the bridge account`, cents: entry.amountCents, tone: "ok", ref: id }))
          .catch(() => {});
      } else {
        entry.funding = { source: "county", status: "fallback", error: r.error };
        logActivity({ system: "solana", what: "Donor pool refused", detail: `${who} · ${r.error ?? "rule not met"} · county fund covers it`, cents: entry.amountCents, tone: "warn" });
      }
      saveLedger();
    })
    .catch((e) => {
      entry.funding = { source: "county", status: "fallback", error: (e as Error).message };
      saveLedger();
    });
}

/** What the public may read about a household in the activity feed. */
function publicLabel(e: { householdId: string; label: string }) {
  return e.householdId.startsWith("live-") ? "Live resident" : e.label;
}

// ---- persistence: restarts never wipe the night; resets archive it ----
const LEDGER_FILE = "data/ledger-state.json";
type Archived = { endedAt: number; entries: Entry[]; spends: SpendEntry[] };
const g = globalThis as unknown as { __evacuaidLedger?: Ledger; __evacuaidArchive?: Archived[] };
function loadLedger(): { ledger: Ledger; archive: Archived[] } {
  try {
    if (existsSync(LEDGER_FILE)) {
      const j = JSON.parse(readFileSync(LEDGER_FILE, "utf8")) as { ledger: [string, Entry][]; spends: SpendEntry[]; archive: Archived[] };
      spends.push(...(j.spends ?? []));
      return { ledger: new Map(j.ledger ?? []), archive: j.archive ?? [] };
    }
  } catch {
    // unreadable: start clean
  }
  return { ledger: new Map(), archive: [] };
}
if (!g.__evacuaidLedger) {
  const loaded = loadLedger();
  g.__evacuaidLedger = loaded.ledger;
  g.__evacuaidArchive = loaded.archive;
}
const ledger: Ledger = g.__evacuaidLedger;
const archive: Archived[] = (g.__evacuaidArchive ??= []);
function saveLedger() {
  try {
    mkdirSync("data", { recursive: true });
    writeFileSync(LEDGER_FILE, JSON.stringify({ ledger: [...ledger.entries()], spends, archive: archive.slice(0, 10) }));
  } catch {
    // read-only disk: keep it in memory
  }
}

function profileFor(householdId: string): { profile: HouseholdProfile; noTransport: boolean; label: string } | null {
  const live = snapshot().households.find((h) => h.id === householdId);
  if (live) {
    return {
      profile: { id: live.id, name: live.name, address: "1100 Woodbury Rd", home: live.location, history: "local" },
      noTransport: live.needs.noTransport,
      label: live.name,
    };
  }
  const sim = SIM_HOUSEHOLDS.find((h) => h.id === householdId);
  if (!sim) return null;
  return {
    profile: {
      id: sim.id,
      name: `Household ${sim.id.slice(1)}`,
      address: sim.address,
      home: sim.location,
      history: PERSONAS[sim.id] ?? "local",
    },
    noTransport: !sim.profile.hasCar || Boolean(PERSONA_CLAIMS[sim.id]?.includes("no car")),
    label: sim.address,
  };
}

export class NotEligible extends Error {}

/** The household as the server knows it: live store, or the replay at that moment of the night. */
function currentState(householdId: string, at: number) {
  return snapshot().households.find((h) => h.id === householdId) ?? householdsAt(at).find((h) => h.id === householdId);
}

export async function stipendFor(
  householdId: string,
  said?: { noTransport?: boolean },
  at = REPLAY_END,
  kind: AidKind = "full",
  override = false,
) {
  const p = profileFor(householdId);
  const h = currentState(householdId, Math.min(Math.max(at, REPLAY_START), REPLAY_END));
  if (!p || !h) throw new Error("Unknown household");
  const e = stipendEligibility(h);
  if (!e.ok) throw new NotEligible(e.reasons.filter((r) => !r.ok).map((r) => r.text).join("; "));
  const outcome = await requestStipend(p.profile, { noTransport: said?.noTransport ?? p.noTransport }, AID_KINDS[kind].cents, override);
  const key = outcome.transactionId ?? `${householdId}:${Date.now()}`;
  const entry: Entry = { ...outcome, at: Date.now(), householdId, label: p.label, kind, replayAt: at, override };
  ledger.set(key, entry);
  const who = publicLabel(entry);
  const why = outcome.checks.find((c) => c.result === "fail") ?? outcome.checks.find((c) => c.result === "flag");
  if (outcome.decision === "declined") {
    logActivity({ system: "nessie", what: "Blocked by bank checks", detail: `${who} · ${why?.detail ?? "check failed"}`, cents: 0, tone: "bad" });
  } else {
    if (outcome.transactionId) {
      logActivity({ system: "nessie", what: "Aid transfer created", detail: `${who} · ${AID_KINDS[kind].label} · county relief account → relief card`, cents: outcome.amountCents, tone: "info", ref: outcome.transactionId });
    }
    logActivity(
      outcome.decision === "approved"
        ? { system: "nessie", what: "Five bank checks passed · approved", detail: `${who}${override ? " · operator override above cap" : ""}`, cents: outcome.amountCents, tone: "ok", ref: outcome.transactionId }
        : { system: "nessie", what: "Held for a person to review · no money moves yet", detail: `${who} · ${why?.detail ?? ""}`, cents: outcome.amountCents, tone: "warn" },
    );
  }
  fundFromPool(entry);
  saveLedger();
  // Tell a real resident exactly what happened.
  if (findLive(householdId)) {
    await aidDecidedLive(householdId, outcome.decision, kind, outcome.amountCents).catch((e) => console.warn("[aid text]", (e as Error).message));
  }
  return outcome;
}

/** Forget tonight's payments and purchases (the bank side is reset separately). */
export function resetLedger() {
  if (ledger.size || spends.length) {
    archive.unshift({ endedAt: Date.now(), entries: [...ledger.values()], spends: [...spends] });
  }
  ledger.clear();
  spends.length = 0;
  resetOps();
  saveLedger();
  logActivity({ system: "evacuaid", what: "Drill ended", detail: "Archived to History · on-chain history unchanged", tone: "info" });
  const run = startNewRun();
  logActivity({ system: "evacuaid", what: `Run ${run} started`, detail: "Fresh $120,000 relief fund · real phones kept · donor pool carries over", tone: "info" });
}

export function earlierRuns() {
  return archive.map((a) => ({
    endedAt: a.endedAt,
    payments: a.entries.filter((e) => e.decision === "approved").length,
    paidCents: a.entries.filter((e) => e.decision === "approved").reduce((s, e) => s + e.amountCents, 0),
    blocked: a.entries.filter((e) => e.decision === "declined").length,
    fromDonorsCents: a.entries.filter((e) => e.funding?.status === "released").reduce((s, e) => s + e.amountCents, 0),
  }));
}

/**
 * The operator dispatches a vehicle. Billed to County Emergency Operations on
 * Nessie (never to relief aid). Live residents get every step by text; simulated
 * ones get the same story on the replay from the moment the operator acted.
 */
export async function dispatchCase(householdId: string, vehicleId: string, at?: number) {
  const live = findLive(householdId);
  const sim = live ? null : householdsAt(at ?? REPLAY_END).find((h) => h.id === householdId);
  const home = live?.location ?? sim?.location;
  if (!home) throw new Error("Unknown household");
  const { v, etaMin, toShelterMin } = planTrip(vehicleId, home);
  if (live?.needs.mobility && !v.wheelchair) throw new Error(`${v.name} can't take a wheelchair`);
  const kind = v.kind === "paratransit" ? "paratransit" : v.kind === "van" ? "van" : "volunteer";
  const label = live ? live.name || "Live resident" : (sim?.address ?? householdId);
  let bill: { transactionId?: string; cents: number; label: string } = { cents: 0, label: "" };
  try {
    bill = await billTrip(kind, label);
  } catch (e) {
    console.warn("[trip bill]", (e as Error).message);
  }
  tigerEvent({ kind: "dispatch", run: currentRun(), system: "evacuaid", household: householdId, detail: `${v.name} · ${etaMin} min` });
  recordDispatch({
    householdId,
    vehicleId: v.id,
    vehicleName: v.name,
    etaMin,
    toShelterMin,
    live: Boolean(live),
    at: live ? Date.now() : (at ?? REPLAY_START),
    billCents: bill.cents,
    billTx: bill.transactionId,
  });
  if (bill.cents) {
    recordBill({ at: Date.now(), householdId, label: bill.label, cents: bill.cents, transactionId: bill.transactionId, vehicleName: v.name });
    logActivity({
      system: "nessie",
      what: "Rescue trip billed to County Emergency Operations",
      detail: `${v.name} · ${etaMin} min away · not relief money`,
      cents: bill.cents,
      tone: "info",
      ref: bill.transactionId,
    });
  }
  if (live) await dispatchLive(householdId, { id: v.id, name: v.name }, etaMin, toShelterMin);
  return { vehicle: v.name, etaMin, toShelterMin, billCents: bill.cents };
}

/** The operator writes to a resident from the console. */
export async function messageCase(householdId: string, text: string, at?: number) {
  if (findLive(householdId)) return operatorMessage(householdId, text);
  recordMessage({ householdId, at: at ?? REPLAY_START, text });
  return { ok: true, via: "simulated" as const };
}

export async function decide(householdId: string, approve: boolean) {
  const entry = [...ledger.values()].find((e) => e.householdId === householdId && e.decision === "held");
  if (!entry) throw new Error("Nothing waiting for a decision");
  const tx = await decideHeld(householdId, approve, entry.amountCents);
  if (tx) entry.transactionId = tx;
  entry.decision = approve ? "approved" : "declined";
  logActivity({
    system: "nessie",
    what: approve ? "Approved by the operator" : "Declined by the operator",
    detail: publicLabel(entry),
    cents: approve ? entry.amountCents : 0,
    tone: approve ? "ok" : "bad",
    ref: entry.transactionId,
  });
  fundFromPool(entry);
  saveLedger();
  if (findLive(householdId)) {
    await aidDecidedLive(householdId, entry.decision, entry.kind, entry.amountCents).catch(() => undefined);
  }
  return entry;
}

export async function spend(householdId: string, merchantKey: string, cents: number) {
  const r = await reliefCardPurchase(householdId, merchantKey, cents);
  const label = profileFor(householdId)?.label ?? householdId;
  spends.unshift({
    at: Date.now(),
    householdId,
    label,
    merchant: r.merchant,
    category: r.category,
    cents,
    approved: r.approved,
    transactionId: r.transactionId,
  });
  logActivity({
    system: "nessie",
    what: r.approved ? "Relief card purchase approved" : "Relief card purchase declined",
    detail: `${r.merchant} · ${r.category}${r.approved ? "" : " is not an evacuation expense"}`,
    cents,
    tone: r.approved ? "ok" : "bad",
    ref: r.transactionId,
  });
  saveLedger();
  return r;
}

/** Demo night: a few real stipend requests through the full Nessie path. */
export async function seedDemoNight() {
  // Families who said money is the barrier, plus two fraud personas and one story that doesn't add up.
  // Other sectors' aid cases, paid at the moment they asked (right-sized), plus
  // the fraud personas so the bank checks have something to catch.
  const aidCases = SIM_EVENTS.filter((e) => e.case?.status === "review" && e.case.kind === "aid")
    .filter((e) => SIM_HOUSEHOLDS.find((h) => h.id === e.householdId)?.sector === "other")
    .slice(0, 4)
    .map((e) => ({ id: e.householdId, kind: (e.case!.aid ?? "gas") as AidKind, at: e.at }));
  const plan: { id: string; kind: AidKind; at: number }[] = [
    ...aidCases,
    { id: "h007", kind: "full", at: REPLAY_END },
    { id: "h019", kind: "night", at: REPLAY_END },
    { id: "h113", kind: "full", at: REPLAY_END },
  ];
  logActivity({ system: "evacuaid", what: "Demo night started", detail: `${plan.length} aid requests through Nessie, then Solana releases and card swipes`, tone: "info" });
  const out = [];
  const has = (id: string) => [...ledger.values()].some((e) => e.householdId === id);
  for (const { id, kind, at } of plan) {
    if (has(id)) continue;
    try {
      out.push({ id, decision: (await stipendFor(id, undefined, at, kind)).decision });
    } catch (e) {
      out.push({ id, error: (e as Error).message });
    }
  }
  // Once the aid settles (~1 min on Nessie's sweep), families start spending.
  const [a1, a2, a3, a4] = aidCases.map((c) => c.id);
  const buys: [string | undefined, string, number][] = [
    [a1, "shell-pasadena", 62_40],
    [a1, "hilton-pasadena", 79_00],
    [a2, "cvs-pasadena", 38_75],
    [a3, "ralphs-pasadena", 54_20],
    [a3, "electronics-glendale", 129_00],
    [a4, "chevron-glendale", 48_10],
  ];
  void (async () => {
    for (const [id, merchant, cents] of buys) {
      if (!id) continue;
      const tx = [...ledger.values()].find((e) => e.householdId === id);
      if (!cents || tx?.decision !== "approved" || !tx.transactionId) continue;
      try {
        await waitForSettled(tx.transactionId);
        await spend(id, merchant, cents);
      } catch (e) {
        console.warn("[demo spend]", id, merchant, (e as Error).message);
      }
    }
  })();
  return out;
}

export async function moneySnapshot() {
  const entries = [...ledger.values()].sort((a, b) => b.at - a.at);
  // Refresh settlement status for anything recently approved.
  await Promise.all(
    entries
      .filter((e) => e.transactionId && e.decision === "approved" && Date.now() - e.at < 10 * 60_000)
      .map(async (e) => {
        try {
          const s = await transactionStatus(e.transactionId!);
          const was = (e as { settlement?: string }).settlement;
          (e as { settlement?: string }).settlement = s.status;
          if (s.status === "completed" && was !== "completed") {
            logActivity({ system: "nessie", what: "Settled: money is on the relief card", detail: publicLabel(e), cents: e.amountCents, tone: "ok", ref: e.transactionId });
            saveLedger();
          }
        } catch {
          // keep the last known status
        }
      }),
  );
  const [fund, pool, ops] = await Promise.all([
    fundSnapshot().catch(() => null),
    poolSnapshot().catch(() => null),
    opsFundSnapshot().catch(() => null),
  ]);
  return { fund, pool, ops, bills: opsActions().bills, stipends: entries, spends: spends.slice(0, 100), earlier: earlierRuns() };
}

/**
 * Where a gift went. The pool is shared, so each family release after the gift
 * draws from it in proportion to what the gift still makes up of the pool.
 */
export async function donorReceipt(id: string) {
  const gift = donations().find((d) => d.id === id);
  if (!gift) return null;
  const pool = await poolSnapshot().catch(() => null);
  const releases = [...ledger.values()]
    .filter((e) => e.funding?.status === "released" && e.funding.sig)
    .map((e) => ({ at: e.at, cents: e.amountCents, sig: e.funding!.sig!, nessieTx: e.transactionId, kind: e.kind }));
  type Ev = { at: number; cents: number; type: "gift" | "release"; ref?: (typeof releases)[number]; mine?: boolean };
  const events: Ev[] = [
    ...donations().map((d) => ({ at: d.at, cents: d.cents, type: "gift" as const, mine: d.id === id })),
    ...releases.map((r) => ({ at: r.at, cents: r.cents, type: "release" as const, ref: r })),
  ].sort((a, b) => a.at - b.at);
  // Rebuild the pool balance before each event, backwards from today's balance.
  let v = pool?.vaultCents ?? 0;
  const before = new Map<Ev, number>();
  for (const e of [...events].reverse()) {
    v = e.type === "release" ? v + e.cents : v - e.cents;
    before.set(e, v);
  }
  let mine = 0;
  const uses: { at: number; fromYouCents: number; totalCents: number; sig: string; nessieTx?: string; kind: string }[] = [];
  for (const e of events) {
    if (e.type === "gift" && e.mine) mine = gift.cents;
    else if (e.type === "release" && mine > 0) {
      const poolBefore = Math.max(1, before.get(e) ?? 1);
      const fromYou = Math.min(mine, Math.round((e.cents * mine) / poolBefore));
      mine -= fromYou;
      uses.push({ at: e.at, fromYouCents: fromYou, totalCents: e.cents, sig: e.ref!.sig, nessieTx: e.ref!.nessieTx, kind: e.ref!.kind });
    }
  }
  return { gift, uses, remainingCents: mine, poolCents: pool?.vaultCents ?? null, shareNow: pool?.vaultCents ? mine / pool.vaultCents : null };
}
