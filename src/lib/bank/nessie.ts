// Capital One Nessie v2: the bank layer of EvacuAid.
// County relief fund, every household's bank account and relief card, merchants
// along the evacuation routes, stipends, the fraud check, and the relief-card rules.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { haversineKm } from "../geo";
import type { LngLat } from "../types";

const BASE = process.env.NESSIE_BASE_URL || "https://v2-prod-api.nessieisreal.com";
const STATE_FILE = "data/nessie-state.json";

export const STIPEND_CENTS = 770_00; // FEMA's Serious Needs Assistance amount
export const ZONE_ZIPS = ["91001"]; // Altadena, the ordered zone in the replay
export const RELIEF_FUND_START_CENTS = 120_000_00;
/** The county's operations budget for the night: vehicles, drivers, fuel, shelter. */
export const OPS_FUND_START_CENTS = 250_000_00;

/** What one rescue trip costs the county, billed to operations (never to relief aid). */
export const TRIP_COST = {
  paratransit: { merchant: "access-paratransit", cents: 95_00, label: "Paratransit trip (driver + accessible van)" },
  van: { merchant: "county-fleet", cents: 70_00, label: "County van trip (driver + fuel)" },
  volunteer: { merchant: "cert-fuel", cents: 25_00, label: "CERT volunteer fuel" },
} as const;
export const EVAC_CATEGORIES = ["gas", "lodging", "food", "pharmacy", "transit"];

async function api<T = unknown>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const key = process.env.NESSIE_API;
  if (!key) throw new Error("NESSIE_API is not set");
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  // 120 requests/min with bursts of 30: wait as long as Nessie asks, then retry.
  if (res.status === 429 && attempt < 5) {
    const wait = Number(res.headers.get("retry-after")) || 2 ** attempt;
    await new Promise((r) => setTimeout(r, wait * 1000));
    return api<T>(path, init, attempt + 1);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Nessie ${init.method ?? "GET"} ${path}: ${body.type ?? res.status} ${body.detail ?? body.title ?? ""}`.trim());
  }
  return body as T;
}

// ---------- persisted ids ----------

type MerchantSeed = { key: string; name: string; category: string; geocode: { lat: number; lng: number }; city: string; zip: string; street: [string, string] };

export const MERCHANTS: MerchantSeed[] = [
  { key: "shell-pasadena", name: "Shell, Colorado Blvd", category: "gas", geocode: { lat: 34.1459, lng: -118.1453 }, city: "Pasadena", zip: "91101", street: ["1001", "E Colorado Blvd"] },
  { key: "chevron-glendale", name: "Chevron, Glendale Ave", category: "gas", geocode: { lat: 34.1513, lng: -118.2511 }, city: "Glendale", zip: "91206", street: ["1311", "N Glendale Ave"] },
  { key: "hilton-pasadena", name: "Hilton Pasadena", category: "lodging", geocode: { lat: 34.1415, lng: -118.1468 }, city: "Pasadena", zip: "91101", street: ["168", "S Los Robles Ave"] },
  { key: "civic-shelter", name: "Pasadena Civic Center Shelter", category: "lodging", geocode: { lat: 34.1436, lng: -118.1438 }, city: "Pasadena", zip: "91101", street: ["300", "E Green St"] },
  { key: "cvs-pasadena", name: "CVS Pharmacy, Lake Ave", category: "pharmacy", geocode: { lat: 34.1529, lng: -118.1318 }, city: "Pasadena", zip: "91101", street: ["1001", "N Lake Ave"] },
  { key: "ralphs-pasadena", name: "Ralphs, Lake Ave", category: "food", geocode: { lat: 34.1491, lng: -118.1321 }, city: "Pasadena", zip: "91101", street: ["160", "N Lake Ave"] },
  { key: "altadena-market", name: "Altadena Market", category: "food", geocode: { lat: 34.1898, lng: -118.1312 }, city: "Altadena", zip: "91001", street: ["2350", "N Lake Ave"] },
  { key: "vegas-casino", name: "Strip Casino & Resort", category: "entertainment", geocode: { lat: 36.1147, lng: -115.1728 }, city: "Las Vegas", zip: "89109", street: ["3570", "S Las Vegas Blvd"] },
  { key: "electronics-glendale", name: "Galleria Electronics", category: "electronics", geocode: { lat: 34.1453, lng: -118.2572 }, city: "Glendale", zip: "91210", street: ["100", "W Broadway"] },
  { key: "access-paratransit", name: "Access Services Paratransit", category: "transport", geocode: { lat: 34.1478, lng: -118.1445 }, city: "Pasadena", zip: "91101", street: ["100", "N Garfield Ave"] },
  { key: "county-fleet", name: "LA County Fleet Services", category: "transport", geocode: { lat: 34.1886, lng: -118.1312 }, city: "Altadena", zip: "91001", street: ["2245", "N Lake Ave"] },
  { key: "cert-fuel", name: "CERT Volunteer Fuel Program", category: "transport", geocode: { lat: 34.1898, lng: -118.1312 }, city: "Altadena", zip: "91001", street: ["2350", "N Lake Ave"] },
];

type HouseholdBank = {
  customerId: string;
  checkingId: string;
  reliefCardId: string;
  zip: string;
  stipendTxId?: string;
  /** Approved so far tonight, across every payment. */
  paidCents?: number;
};

/** FEMA's Serious Needs Assistance amount: the most one household gets tonight. */
export const HOUSEHOLD_CAP_CENTS = 770_00;
const paidSoFar = (hb: HouseholdBank) => hb.paidCents ?? (hb.stipendTxId ? STIPEND_CENTS : 0);
type BankState = {
  countyCustomerId?: string;
  reliefFundId?: string;
  solanaBridgeId?: string;
  /** County Emergency Operations: vehicles, drivers, fuel, shelter. Separate from relief aid. */
  opsFundId?: string;
  merchants: Record<string, string>;
  households: Record<string, HouseholdBank>;
};

const g = globalThis as unknown as { __evacuaidBank?: BankState };
function state(): BankState {
  if (g.__evacuaidBank) return g.__evacuaidBank;
  g.__evacuaidBank = existsSync(STATE_FILE)
    ? (JSON.parse(readFileSync(STATE_FILE, "utf8")) as BankState)
    : { merchants: {}, households: {} };
  return g.__evacuaidBank;
}
function save() {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state(), null, 2));
}

// ---------- setup ----------

type Created = { id: string };

/** County customer, relief fund ($120k), Solana bridge account, and merchants. Idempotent. */
export async function ensureBank() {
  const s = state();
  if (!s.countyCustomerId) {
    const c = await api<Created>("/customers", {
      method: "POST",
      body: JSON.stringify({
        first_name: "LA County",
        last_name: "Office of Emergency Management",
        address: { street_number: "1275", street_name: "N Eastern Ave", city: "Los Angeles", state: "CA", zip: "90063" },
      }),
    });
    s.countyCustomerId = c.id;
  }
  if (!s.reliefFundId) {
    const a = await api<Created>(`/customers/${s.countyCustomerId}/accounts`, {
      method: "POST",
      body: JSON.stringify({ type: "Checking", nickname: "Evacuation Relief Fund", balance_cents: RELIEF_FUND_START_CENTS }),
    });
    s.reliefFundId = a.id;
  }
  if (!s.solanaBridgeId) {
    const a = await api<Created>(`/customers/${s.countyCustomerId}/accounts`, {
      method: "POST",
      body: JSON.stringify({ type: "Checking", nickname: "Solana Relief Pool Bridge", balance_cents: 0 }),
    });
    s.solanaBridgeId = a.id;
  }
  if (!s.opsFundId) {
    const a = await api<Created>(`/customers/${s.countyCustomerId}/accounts`, {
      method: "POST",
      body: JSON.stringify({ type: "Checking", nickname: "County Emergency Operations", balance_cents: OPS_FUND_START_CENTS }),
    });
    s.opsFundId = a.id;
  }
  for (const m of MERCHANTS) {
    if (s.merchants[m.key]) continue;
    const created = await api<Created>("/merchants", {
      method: "POST",
      body: JSON.stringify({
        name: m.name,
        category: m.category,
        geocode: m.geocode,
        address: { street_number: m.street[0], street_name: m.street[1], city: m.city, state: m.city === "Las Vegas" ? "NV" : "CA", zip: m.zip },
      }),
    });
    s.merchants[m.key] = created.id;
  }
  save();
  return s;
}

export type HouseholdProfile = {
  id: string;
  name: string;
  address: string; // e.g. "1117 Altadena Dr"
  zip?: string;
  home: LngLat;
  /** Demo personas: where this person's card has been used recently. */
  history?: "local" | "vegas" | "commuter";
};

/** A household's customer, checking account, and relief card, with some card history. */
export async function ensureHousehold(p: HouseholdProfile): Promise<HouseholdBank> {
  const s = await ensureBank();
  const existing = s.households[p.id];
  if (existing) return existing;

  const [first, ...rest] = (p.name || "Resident").split(" ");
  const m = p.address.match(/^(\d+)\s+(.*)$/);
  const zip = p.zip ?? "91001";
  const customer = await api<Created>("/customers", {
    method: "POST",
    body: JSON.stringify({
      first_name: first,
      last_name: rest.join(" ") || "Household",
      address: { street_number: m?.[1] ?? "1", street_name: (m?.[2] ?? p.address).slice(0, 80), city: "Altadena", state: "CA", zip },
    }),
  });
  const checking = await api<Created>(`/customers/${customer.id}/accounts`, {
    method: "POST",
    body: JSON.stringify({ type: "Checking", nickname: "Checking", balance_cents: 340_00 }),
  });
  const relief = await api<Created>(`/customers/${customer.id}/accounts`, {
    method: "POST",
    body: JSON.stringify({ type: "Checking", nickname: "EvacuAid Relief Card", balance_cents: 0 }),
  });

  // Recent card history the fraud check reads.
  const spend = async (key: string, cents: number, description: string) => {
    const tx = await api<{ id: string }>(`/accounts/${checking.id}/purchases`, {
      method: "POST",
      body: JSON.stringify({ merchant_id: s.merchants[key], amount_cents: cents, description }),
    });
    await api(`/transactions/${tx.id}/settle`, { method: "POST" }).catch(() => undefined);
  };
  if (p.history === "vegas") {
    await spend("vegas-casino", 180_00, "STRIP CASINO & RESORT LAS VEGAS NV");
    await spend("vegas-casino", 64_00, "STRIP CASINO & RESORT LAS VEGAS NV");
  } else if (p.history === "commuter") {
    await spend("shell-pasadena", 52_00, "SHELL OIL 57449 PASADENA CA");
    await spend("altadena-market", 23_40, "ALTADENA MARKET ALTADENA CA");
  } else {
    await spend("altadena-market", 41_20, "ALTADENA MARKET ALTADENA CA");
    await spend("ralphs-pasadena", 66_75, "RALPHS #112 PASADENA CA");
  }

  const hb: HouseholdBank = { customerId: customer.id, checkingId: checking.id, reliefCardId: relief.id, zip };
  s.households[p.id] = hb;
  save();
  return hb;
}

// ---------- fraud check ----------

export type CheckResult = { name: string; result: "pass" | "flag" | "fail"; detail: string };

type Tx = { id: string; status?: string; kind?: string; merchant_id?: string; amount_cents?: number; created_at?: string; payee_id?: string };

async function recentTransactions(accountId: string): Promise<Tx[]> {
  const r = await api<{ items?: Tx[] } | Tx[]>(`/accounts/${accountId}/transactions?limit=50`);
  return Array.isArray(r) ? r : (r.items ?? []);
}

/** The five checks, run on banking data before any stipend settles. */
export async function fraudCheck(
  p: HouseholdProfile,
  hb: HouseholdBank,
  said: { noTransport?: boolean },
  amountCents = STIPEND_CENTS,
  override = false,
): Promise<CheckResult[]> {
  const s = state();
  const merchantById = new Map(MERCHANTS.map((m) => [s.merchants[m.key], m]));
  const txs = await recentTransactions(hb.checkingId);
  const purchases = txs.filter((t) => t.merchant_id);
  const checks: CheckResult[] = [];

  // 1. Residency: is the home address inside the ordered zone?
  checks.push(
    ZONE_ZIPS.includes(hb.zip)
      ? { name: "Residency", result: "pass", detail: `Home ZIP ${hb.zip} is inside the evacuation zone` }
      : { name: "Residency", result: "fail", detail: `Home ZIP ${hb.zip} is outside the evacuation zone` },
  );

  // 2. Whereabouts: where has the card been used?
  const far = purchases
    .map((t) => ({ t, m: merchantById.get(t.merchant_id!) }))
    .filter((x) => x.m)
    .map((x) => ({ ...x, km: haversineKm(p.home, x.m!.geocode) }))
    .sort((a, b) => b.km - a.km)[0];
  if (!far) checks.push({ name: "Whereabouts", result: "flag", detail: "No recent card activity to compare" });
  else if (far.km > 80)
    checks.push({ name: "Whereabouts", result: "fail", detail: `Card used at ${far.m!.name}, ${Math.round(far.km)} km from home` });
  else checks.push({ name: "Whereabouts", result: "pass", detail: `Recent card use within ${Math.max(1, Math.round(far.km))} km of home` });

  // 3. Account history: brand-new accounts with no activity get a human look.
  checks.push(
    purchases.length >= 2
      ? { name: "Account history", result: "pass", detail: `${purchases.length} prior transactions` }
      : { name: "Account history", result: "flag", detail: "Little or no account history" },
  );

  // 4. Household cap: never more than $770 to one household, however it's split.
  const before = paidSoFar(hb);
  const usd = (c: number) => `$${(c / 100).toFixed(0)}`;
  checks.push(
    before + amountCents > HOUSEHOLD_CAP_CENTS && override
      ? {
          name: "Household cap",
          result: "pass",
          detail: `Operator override: ${usd(before + amountCents)}, over the ${usd(HOUSEHOLD_CAP_CENTS)} cap. Extra comes from the county fund`,
        }
      : before + amountCents > HOUSEHOLD_CAP_CENTS
      ? {
          name: "Household cap",
          result: "fail",
          detail: `Already received ${usd(before)}; ${usd(amountCents)} more would pass the ${usd(HOUSEHOLD_CAP_CENTS)} cap`,
        }
      : {
          name: "Household cap",
          result: "pass",
          detail: before
            ? `${usd(before)} paid before; ${usd(before + amountCents)} of ${usd(HOUSEHOLD_CAP_CENTS)} after this`
            : "First payment to this household",
        },
  );

  // 5. Story vs. data: said "no car" but buys gas regularly?
  const gas = purchases.filter((t) => merchantById.get(t.merchant_id!)?.category === "gas").length;
  checks.push(
    said.noTransport && gas > 0
      ? { name: "Story vs. spending", result: "flag", detail: `Said no car, but ${gas} recent gas purchase${gas > 1 ? "s" : ""}` }
      : { name: "Story vs. spending", result: "pass", detail: "What they said matches their spending" },
  );

  return checks;
}

export type StipendOutcome = {
  decision: "approved" | "held" | "declined";
  transactionId?: string;
  checks: CheckResult[];
  amountCents: number;
};

/** County fund to household relief card: pending, checked, then approved or declined. */
export async function requestStipend(
  p: HouseholdProfile,
  said: { noTransport?: boolean },
  amountCents = STIPEND_CENTS,
  override = false,
): Promise<StipendOutcome> {
  const s = await ensureBank();
  const hb = await ensureHousehold(p);
  const checks = await fraudCheck(p, hb, said, amountCents, override);
  const fails = checks.filter((c) => c.result === "fail");
  const flags = checks.filter((c) => c.result === "flag");

  if (fails.length) return { decision: "declined", checks, amountCents };
  // Held: nothing moves until a person approves it (Nessie settles pending transfers on its own sweep).
  if (flags.length) return { decision: "held", checks, amountCents };

  const tx = await api<{ id: string }>(`/accounts/${s.reliefFundId}/transfers`, {
    method: "POST",
    body: JSON.stringify({ payee_id: hb.reliefCardId, amount_cents: amountCents, description: `EvacuAid aid ${p.id}` }),
  });
  await api(`/transactions/${tx.id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision: "approve", reason: "EvacuAid fraud check passed" }),
  });
  // Hosted Nessie applies decisions on its settlement sweep (within about a minute).
  hb.stipendTxId = tx.id;
  hb.paidCents = paidSoFar(hb) + amountCents;
  save();
  return { decision: "approved", transactionId: tx.id, checks, amountCents };
}

/** A person decided a held claim. Approve: only now does the transfer get created and approved. */
export async function decideHeld(householdId: string, approve: boolean, amountCents = STIPEND_CENTS): Promise<string | undefined> {
  if (!approve) return undefined;
  const s = await ensureBank();
  const hb = s.households[householdId];
  if (!hb) throw new Error("No relief card for this household");
  const tx = await api<{ id: string }>(`/accounts/${s.reliefFundId}/transfers`, {
    method: "POST",
    body: JSON.stringify({ payee_id: hb.reliefCardId, amount_cents: amountCents, description: `EvacuAid aid ${householdId} (operator approved)` }),
  });
  await api(`/transactions/${tx.id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision: "approve", reason: "Approved by operator after review" }),
  });
  hb.paidCents = paidSoFar(hb) + amountCents;
  hb.stipendTxId = tx.id;
  save();
  return tx.id;
}

/** Relief card spending: only evacuation categories go through. */
export async function reliefCardPurchase(householdId: string, merchantKey: string, cents: number) {
  const s = await ensureBank();
  const hb = s.households[householdId];
  if (!hb) throw new Error("No relief card for this household yet");
  const merchant = MERCHANTS.find((m) => m.key === merchantKey);
  if (!merchant) throw new Error("Unknown merchant");
  const card = await api<{ available_cents: number }>(`/accounts/${hb.reliefCardId}`);
  if (card.available_cents < cents) throw new Error("The stipend is still settling (about a minute). Try again shortly.");
  const tx = await api<{ id: string }>(`/accounts/${hb.reliefCardId}/purchases`, {
    method: "POST",
    body: JSON.stringify({ merchant_id: s.merchants[merchantKey], amount_cents: cents, description: merchant.name.toUpperCase() }),
  });
  const allowed = EVAC_CATEGORIES.includes(merchant.category);
  await api(`/transactions/${tx.id}/decision`, {
    method: "POST",
    body: JSON.stringify({
      decision: allowed ? "approve" : "decline",
      reason: allowed ? `Evacuation expense: ${merchant.category}` : `Not an evacuation expense: ${merchant.category}`,
    }),
  });
  return { transactionId: tx.id, approved: allowed, merchant: merchant.name, category: merchant.category };
}

export async function transactionStatus(id: string) {
  const t = await api<{ status: string; decision_reason?: string }>(`/transactions/${id}`);
  return { status: t.status, reason: t.decision_reason };
}

/** Wait for Nessie's settlement sweep to finish a transaction. */
export async function waitForSettled(id: string, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const s = await transactionStatus(id);
    if (s.status !== "pending") return s;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return transactionStatus(id);
}

/** Bill one rescue trip to County Emergency Operations (a real purchase on Nessie). */
export async function billTrip(kind: keyof typeof TRIP_COST, householdRef: string) {
  const s = await ensureBank();
  const t = TRIP_COST[kind];
  const tx = await api<{ id: string }>(`/accounts/${s.opsFundId}/purchases`, {
    method: "POST",
    body: JSON.stringify({ merchant_id: s.merchants[t.merchant], amount_cents: t.cents, description: `${t.label} · ${householdRef}` }),
  });
  await api(`/transactions/${tx.id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision: "approve", reason: `Evacuation transport · ${householdRef}` }),
  });
  return { transactionId: tx.id, cents: t.cents, label: t.label };
}

/** Donor money released on Solana lands in the county's bridge account on Nessie: the pool paying the county back. */
export async function depositFromPool(cents: number, sig: string, householdRef: string) {
  const s = await ensureBank();
  if (!s.solanaBridgeId) return undefined;
  const tx = await api<{ id: string }>(`/accounts/${s.solanaBridgeId}/deposits`, {
    method: "POST",
    body: JSON.stringify({ amount_cents: cents, medium: "balance", description: `Solana release ${sig.slice(0, 8)} · ${householdRef}` }),
  });
  await api(`/transactions/${tx.id}/settle`, { method: "POST" }).catch(() => undefined);
  return tx.id;
}

export async function opsSnapshot() {
  const s = state();
  if (!s.opsFundId) return null;
  const a = await api<{ balance_cents: number; available_cents: number }>(`/accounts/${s.opsFundId}`);
  return { balanceCents: a.balance_cents, availableCents: a.available_cents, startingCents: OPS_FUND_START_CENTS };
}

/** New night: open a fresh county relief fund and forget household payments (caps start over). */
export async function freshFund() {
  const s = await ensureBank();
  const a = await api<Created>(`/customers/${s.countyCustomerId}/accounts`, {
    method: "POST",
    body: JSON.stringify({ type: "Checking", nickname: "Evacuation Relief Fund", balance_cents: RELIEF_FUND_START_CENTS }),
  });
  s.reliefFundId = a.id;
  const ops = await api<Created>(`/customers/${s.countyCustomerId}/accounts`, {
    method: "POST",
    body: JSON.stringify({ type: "Checking", nickname: "County Emergency Operations", balance_cents: OPS_FUND_START_CENTS }),
  });
  s.opsFundId = ops.id;
  s.households = {};
  save();
  return a.id;
}

export async function fundSnapshot() {
  const s = state();
  if (!s.reliefFundId) return null;
  const a = await api<{ balance_cents: number; available_cents: number; pending_debits_cents: number }>(`/accounts/${s.reliefFundId}`);
  const stipends = Object.values(s.households).filter((h) => h.stipendTxId).length;
  const bridge = s.solanaBridgeId
    ? await api<{ balance_cents: number }>(`/accounts/${s.solanaBridgeId}`).catch(() => null)
    : null;
  return {
    balanceCents: a.balance_cents,
    availableCents: a.available_cents,
    pendingCents: a.pending_debits_cents,
    startingCents: RELIEF_FUND_START_CENTS,
    bridgeCents: bridge?.balance_cents ?? 0,
    stipends,
    accounts: { reliefFund: s.reliefFundId, solanaBridge: s.solanaBridgeId ?? null },
  };
}
