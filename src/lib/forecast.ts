// Monte Carlo forecast of how much relief money the next hours will need.
//
// Each run draws: how fast the fire spreads (lognormal around the observed rate),
// which households it reaches within the horizon, which of them need money to
// leave (more likely for low-income households), and what leaving costs them
// (the $770 stipend plus 0-4 hotel nights). Thousands of runs give a spread of
// outcomes; we report the median (P50) and the bad case (P90).

import { rng } from "./rng";

/** How the county spends: what each family gets, and how rooms are handled. */
export type Policy = {
  stipendCents: number;
  hotelNightCents: number;
  /** Share of families sent to the free shelter instead of a paid room. */
  shelterShare: number;
  /** Most paid nights per family. */
  maxNights: number;
};

export const DEFAULT_POLICY: Policy = { stipendCents: 770_00, hotelNightCents: 165_00, shelterShare: 0, maxNights: 99 };

export type ForecastInput = {
  now: number; // ms
  horizonHours: number;
  policy?: Partial<Policy>;
  /** What-if: the fire spreads this many times faster (1 = as observed). */
  speedScale?: number;
  households: { fireEta: number; lowIncome: boolean; paid: boolean }[];
  availableCents: number; // relief fund + Solana pool
  runs?: number;
  seed?: number;
};

export type ForecastResult = {
  p50Cents: number;
  p90Cents: number;
  meanCents: number;
  shortfallChance: number; // share of runs where need > available
  histogram: { fromCents: number; toCents: number; count: number }[];
  runs: number;
  /** Families paid in a typical night (median). */
  familiesP50: number;
  /** Cumulative need at the end of each hour: the budget burn-down. */
  timeline: { at: number; p10Cents: number; p50Cents: number; p90Cents: number }[];
};


function normal(r: () => number) {
  // Box-Muller
  const u = Math.max(r(), 1e-12);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function poisson(r: () => number, lambda: number) {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > l);
  return k - 1;
}

export function forecastFund(input: ForecastInput): ForecastResult {
  const runs = input.runs ?? 2000;
  const r = rng(input.seed ?? 11);
  const horizonEnd = input.now + input.horizonHours * 3_600_000;
  const pol = { ...DEFAULT_POLICY, ...input.policy };
  const H = Math.max(1, Math.ceil(input.horizonHours));
  const totals: number[] = [];
  const counts: number[] = [];
  const byHour: number[][] = Array.from({ length: H }, () => []);

  for (let i = 0; i < runs; i++) {
    // Spread faster or slower than observed: lognormal, sigma 0.35.
    const speed = Math.exp(0.35 * normal(r)) * (input.speedScale ?? 1);
    let total = 0;
    let paidFamilies = 0;
    const hours = new Array<number>(H).fill(0);
    for (const h of input.households) {
      // Already paid, or the fire already passed (that night's money is in the ledger, not the forecast).
      if (h.paid || h.fireEta < input.now) continue;
      const eta = input.now + (h.fireEta - input.now) / speed;
      if (eta > horizonEnd) continue;
      const needsMoney = r() < (h.lowIncome ? 0.55 : 0.15);
      if (!needsMoney) continue;
      // Money goes out about an hour before the fire reaches them (when they're told to leave).
      const nights = r() < pol.shelterShare ? 0 : Math.min(pol.maxNights, poisson(r, 1.4));
      const cost = pol.stipendCents + nights * pol.hotelNightCents;
      total += cost;
      paidFamilies++;
      hours[Math.min(H - 1, Math.max(0, Math.floor((eta - input.now) / 3_600_000)))] += cost;
    }
    totals.push(total);
    counts.push(paidFamilies);
    let cum = 0;
    for (let k = 0; k < H; k++) byHour[k].push((cum += hours[k]));
  }

  totals.sort((a, b) => a - b);
  const q = (p: number) => totals[Math.min(totals.length - 1, Math.floor(p * totals.length))];
  const max = totals[totals.length - 1] || 1;
  const bins = 24;
  const width = Math.ceil(max / bins) || 1;
  const histogram = Array.from({ length: bins }, (_, b) => ({ fromCents: b * width, toCents: (b + 1) * width, count: 0 }));
  for (const t of totals) histogram[Math.min(bins - 1, Math.floor(t / width))].count++;

  return {
    p50Cents: q(0.5),
    p90Cents: q(0.9),
    meanCents: Math.round(totals.reduce((a, b) => a + b, 0) / runs),
    shortfallChance: totals.filter((t) => t > input.availableCents).length / runs,
    histogram,
    runs,
    familiesP50: [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)] ?? 0,
    timeline: byHour.map((v, k) => {
      v.sort((a, b) => a - b);
      const qq = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
      return { at: input.now + (k + 1) * 3_600_000, p10Cents: qq(0.1), p50Cents: qq(0.5), p90Cents: qq(0.9) };
    }),
  };
}
