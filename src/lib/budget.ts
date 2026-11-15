// Budget plans and the advice the operator sees. Shared by the console's money
// panel and the relief page so both always say the same thing.

import type { ForecastResult, Policy } from "./forecast";

export const STIPEND_CENTS = 770_00; // FEMA Serious Needs Assistance amount
/** Most any one household can receive tonight, across every payment (FEMA's SNA amount). */
export const HOUSEHOLD_CAP_CENTS = 770_00;

/** Right-sized aid: the operator pays what gets this family out, not always the maximum. */
export const AID_KINDS = {
  gas: { label: "Gas to leave", cents: 150_00, what: "A full tank and a little extra" },
  night: { label: "Gas + a night", cents: 315_00, what: "Gas plus one room near the shelter" },
  full: { label: "Full stipend", cents: 770_00, what: "Gas, food and two nights: FEMA's amount" },
} as const;
export type AidKind = keyof typeof AID_KINDS;
/** Donor money pledged to the Solana relief pool for this incident (released by the evacuation order). */
export const POOL_PLEDGED_CENTS = 50_000_00;

export type Plan = { key: string; letter: string; name: string; what: string; policy: Partial<Policy>; extraCents: number };

export const PLANS: Plan[] = [
  {
    key: "shelter",
    letter: "A",
    name: "Shelter first",
    what: "Free shelter before paid rooms; at most 2 paid nights",
    policy: { shelterShare: 0.6, maxNights: 2 },
    extraCents: 0,
  },
  { key: "asked", letter: "B", name: "Pay as asked", what: "$770 plus the room nights each family asks for", policy: {}, extraCents: 0 },
  {
    key: "pool",
    letter: "C",
    name: "Pay as asked + Solana pool",
    what: "Same, with the donor pool released",
    policy: {},
    extraCents: POOL_PLEDGED_CENTS,
  },
];

export type Advice = {
  tone: "ok" | "watch" | "short";
  headline: string;
  detail: string;
  /** Money left after a bad night under the current plan (negative = short). */
  headroomCents: number;
  /** Extra families the headroom covers at $770 (or the shortfall in families). */
  families: number;
};

/** What to tell the operator, from the Monte Carlo of each plan. */
export function advise(availableCents: number, forecasts: Record<string, ForecastResult>): Advice {
  const asked = forecasts.asked;
  const headroom = availableCents - asked.p90Cents;
  const families = Math.floor(Math.abs(headroom) / STIPEND_CENTS);
  const lasts = (k: string) => Math.round((1 - forecasts[k].shortfallChance) * 100);

  if (asked.p50Cents > availableCents) {
    return {
      tone: "short",
      headline: "Likely to run out tonight",
      detail: `Paying as asked runs short on a typical night. Shelter first lasts ${lasts("shelter")}% of nights; with the Solana pool, ${lasts("pool")}%.`,
      headroomCents: headroom,
      families,
    };
  }
  if (headroom < 0) {
    return {
      tone: "watch",
      headline: `Enough tonight, unless it's a bad night`,
      detail: `A bad night is ${families} families more than the fund covers. Shelter first lasts ${lasts("shelter")}% of nights; releasing the Solana pool, ${lasts("pool")}%.`,
      headroomCents: headroom,
      families,
    };
  }
  return {
    tone: "ok",
    headline: "Covered, even on a bad night",
    detail: `About ${families} more families could get $770 beyond the bad-night estimate. Keep paying.`,
    headroomCents: headroom,
    families,
  };
}
