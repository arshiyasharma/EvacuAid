import { describe, expect, it } from "vitest";
import { forecastFund } from "../forecast";

const now = 0;
const hour = 3_600_000;

describe("forecastFund", () => {
  it("needs nothing when no household is within reach", () => {
    const r = forecastFund({ now, horizonHours: 2, availableCents: 0, households: [{ fireEta: 100 * hour, lowIncome: true, paid: false }] });
    expect(r.p90Cents).toBe(0);
  });

  it("P90 is at least P50, and low-income households raise the need", () => {
    const mk = (lowIncome: boolean) => Array.from({ length: 200 }, () => ({ fireEta: hour, lowIncome, paid: false }));
    const poor = forecastFund({ now, horizonHours: 6, availableCents: 0, households: mk(true) });
    const rich = forecastFund({ now, horizonHours: 6, availableCents: 0, households: mk(false) });
    expect(poor.p90Cents).toBeGreaterThanOrEqual(poor.p50Cents);
    expect(poor.p50Cents).toBeGreaterThan(rich.p50Cents * 2);
  });

  it("skips households already paid and reports shortfall risk", () => {
    const hs = Array.from({ length: 100 }, () => ({ fireEta: hour, lowIncome: true, paid: true }));
    expect(forecastFund({ now, horizonHours: 6, availableCents: 0, households: hs }).p90Cents).toBe(0);
    const unpaid = hs.map((h) => ({ ...h, paid: false }));
    expect(forecastFund({ now, horizonHours: 6, availableCents: 1, households: unpaid }).shortfallChance).toBeGreaterThan(0.99);
  });
});

describe("budget plans", () => {
  const now = 0;
  const households = Array.from({ length: 300 }, (_, i) => ({ fireEta: (i % 6) * 3_600_000 + 1, lowIncome: i % 3 === 0, paid: false }));
  it("shelter-first costs less than paying for rooms", () => {
    const base = forecastFund({ now, horizonHours: 6, households, availableCents: 0, runs: 500 });
    const shelter = forecastFund({ now, horizonHours: 6, households, availableCents: 0, runs: 500, policy: { shelterShare: 0.6, maxNights: 2 } });
    expect(shelter.p50Cents).toBeLessThan(base.p50Cents);
  });
  it("burn-down only goes up hour by hour", () => {
    const f = forecastFund({ now, horizonHours: 6, households, availableCents: 0, runs: 500 });
    expect(f.timeline).toHaveLength(6);
    for (let k = 1; k < 6; k++) expect(f.timeline[k].p50Cents).toBeGreaterThanOrEqual(f.timeline[k - 1].p50Cents);
  });
});
