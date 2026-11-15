// Alerts-only vs EvacuAid, on the real Eaton fire.
//
// Same households, same 22 vehicles, same dispatch rule, same real fire timing
// (from NASA's satellite detections). The only difference is when help can
// start: EvacuAid's two-way alert (from its worst-case forecast, knowable on the
// night) or the real west Altadena order at 3:25 AM. The baseline is generous:
// it assumes that after the order, responders know exactly who needs a ride.
//
// Each run varies how long people take to reply, how long the operator takes to
// decide, and when the fire really reached each home (satellites pass hours
// apart, so arrival is uncertain by about ±30 minutes).

import { haversineKm } from "../geo";
import { rng } from "../rng";
import type { LngLat } from "../types";
import { REAL_WEST_ALTADENA_ORDER } from "./eaton";
import { FLEET, SHELTER } from "./fleet";
import { OTHER_FLEET, SIM_HOUSEHOLDS } from "./households";

const MIN = 60_000;
const drive = (a: LngLat, b: LngLat) => ((haversineKm(a, b) * 1.35) / 30) * 60;

/** Who can't leave without a vehicle, from each household's story. */
const RIDES: Record<string, { people: number; wheelchair: boolean; silent?: boolean }> = {
  ride_wheelchair: { people: 2, wheelchair: true },
  ride_mom: { people: 2, wheelchair: true },
  ride_father_es: { people: 2, wheelchair: true },
  ride_oxygen_es: { people: 4, wheelchair: false },
  ride_blocked: { people: 3, wheelchair: false },
  dialysis: { people: 1, wheelchair: false },
  neighbor: { people: 1, wheelchair: false },
  money_no_car: { people: 3, wheelchair: false },
  silent: { people: 1, wheelchair: false, silent: true },
};

const NEEDS = SIM_HOUSEHOLDS.filter((h) => RIDES[h.story]).map((h) => ({ h, ...RIDES[h.story] }));
const VEHICLES = [
  ...FLEET.map((v) => ({ name: v.name, wheelchair: v.wheelchair, pos: v.location })),
  ...OTHER_FLEET.map((v) => ({ name: v.name, wheelchair: v.wheelchair, pos: v.pos })),
];

type Run = { people: number; households: number; marginMin: number[] };

/** The first satellite pass that saw fire near west Altadena (1:02 AM). */
export const FIRST_SATELLITE_SIGHTING = Date.UTC(2025, 0, 8, 9, 2);

function simulate(mode: "evacuaid" | "alerts" | "satellite", r: () => number): Run {
  const requests = NEEDS.map((n) => {
    const start = mode === "evacuaid" ? n.h.alertAt : mode === "satellite" ? FIRST_SATELLITE_SIGHTING : REAL_WEST_ALTADENA_ORDER;
    // Reply 2–20 min after the alert; silent homes need two nudges and a knock decision.
    const reply = (2 + r() * 18 + (n.silent ? 70 : 0)) * MIN;
    const decide = (2 + r() * 6) * MIN;
    const fireAt = n.h.fireEta + (r() * 60 - 30) * MIN;
    return { ...n, at: start + reply + decide, fireAt };
  }).sort((a, b) => a.at - b.at);

  const fleet = VEHICLES.map((v) => ({ ...v, freeAt: 0 }));
  const out: Run = { people: 0, households: 0, marginMin: [] };
  for (const q of requests) {
    let best: { v: (typeof fleet)[number]; pickup: number } | null = null;
    for (const v of fleet) {
      if (q.wheelchair && !v.wheelchair) continue;
      const pickup = Math.max(q.at, v.freeAt) + (drive(v.pos, q.h.location) + (q.wheelchair ? 8 : 4)) * MIN;
      if (!best || pickup < best.pickup) best = { v, pickup };
    }
    if (!best) continue;
    // Nobody drives into a burning street: a trip only counts if pickup beats the fire.
    if (best.pickup <= q.fireAt) {
      out.people += q.people;
      out.households += 1;
      out.marginMin.push((q.fireAt - best.pickup) / MIN);
      const toShelter = drive(q.h.location, SHELTER.location);
      best.v.freeAt = best.pickup + toShelter * 2 * MIN;
      best.v.pos = SHELTER.location;
    }
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
function ci95(xs: number[]) {
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  const half = (1.96 * sd) / Math.sqrt(Math.max(1, xs.length));
  return { mean: m, low: m - half, high: m + half };
}

export type Counterfactual = {
  runs: number;
  needPeople: number;
  needHouseholds: number;
  evacuaid: { people: ReturnType<typeof ci95>; households: ReturnType<typeof ci95>; medianMarginMin: number };
  alerts: { people: ReturnType<typeof ci95>; households: ReturnType<typeof ci95>; medianMarginMin: number };
  /** A fairer baseline: one-way alert the moment satellites first saw fire nearby (1:02 AM). */
  satellite: { people: ReturnType<typeof ci95>; households: ReturnType<typeof ci95>; medianMarginMin: number };
  /** Paired difference per run (same random draws for both). */
  extraPeople: ReturnType<typeof ci95>;
};

export function counterfactual(runs = 200, seed = 7): Counterfactual {
  const e: Run[] = [];
  const a: Run[] = [];
  const sat: Run[] = [];
  for (let i = 0; i < runs; i++) {
    // Paired: both scenarios see the same reply times and fire uncertainty.
    e.push(simulate("evacuaid", rng(seed * 1000 + i)));
    a.push(simulate("alerts", rng(seed * 1000 + i)));
    sat.push(simulate("satellite", rng(seed * 1000 + i)));
  }
  const median = (xs: number[]) => {
    const s = [...xs].sort((p, q) => p - q);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  return {
    runs,
    needPeople: NEEDS.reduce((s, n) => s + n.people, 0),
    needHouseholds: NEEDS.length,
    evacuaid: { people: ci95(e.map((x) => x.people)), households: ci95(e.map((x) => x.households)), medianMarginMin: median(e.flatMap((x) => x.marginMin)) },
    alerts: { people: ci95(a.map((x) => x.people)), households: ci95(a.map((x) => x.households)), medianMarginMin: median(a.flatMap((x) => x.marginMin)) },
    satellite: { people: ci95(sat.map((x) => x.people)), households: ci95(sat.map((x) => x.households)), medianMarginMin: median(sat.flatMap((x) => x.marginMin)) },
    extraPeople: ci95(e.map((x, i) => x.people - a[i].people)),
  };
}
