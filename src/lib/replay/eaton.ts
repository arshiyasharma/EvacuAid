// The Eaton fire, replayed from NASA FIRMS detections (see scripts/build_eaton.py).

import data from "@/data/eaton-fire.json";
import { haversineKm } from "../geo";
import type { HazardSnapshot, LngLat } from "../types";

export type FirePoint = {
  lng: number;
  lat: number;
  arrival: number; // estimated time this spot caught (ms)
  seen: number; // when a satellite actually saw it (ms)
  frp: number; // fire radiative power, MW
  source: string;
};

const RAW = data as {
  name: string;
  ignition: number;
  windowEnd: number;
  origin: LngLat;
  passes: { at: number; sources: string[]; count: number }[];
  points: FirePoint[];
  note: string;
};

/**
 * Satellites pass every few hours, so when a spot started burning is uncertain.
 * We show each spot at most 45 minutes before a satellite actually saw it, so the
 * map never puts fire somewhere earlier than the evidence allows.
 */
const SEEN_LEAD_MS = 45 * 60_000;
export const FIRE = {
  ...RAW,
  points: RAW.points.map((p) => ({ ...p, arrival: Math.max(p.arrival, p.seen - SEEN_LEAD_MS) })),
};

/** Replay window: 6:00 PM Jan 7 to 6:00 AM Jan 8, Pacific. */
export const REPLAY_START = Date.UTC(2025, 0, 8, 2, 0); // 6:00 PM PST
export const REPLAY_END = FIRE.windowEnd;

/** The real order for west Altadena (LA Times reporting). */
export const REAL_WEST_ALTADENA_ORDER = Date.UTC(2025, 0, 8, 11, 25); // 3:25 AM PST

/**
 * Spread rate seen in the data: the farthest spot from the origin at each
 * satellite pass, divided by the time since ignition. We use the fastest pass,
 * which is the honest worst case for people downwind.
 */
export const RATE_OF_SPREAD_KMH = (() => {
  let best = 0;
  for (const pass of FIRE.passes) {
    const hours = (pass.at - FIRE.ignition) / 3_600_000;
    if (hours <= 0) continue;
    const far = FIRE.points
      .filter((p) => p.seen <= pass.at)
      .reduce((m, p) => Math.max(m, haversineKm(FIRE.origin, p)), 0);
    best = Math.max(best, far / hours);
  }
  return Math.round(best * 10) / 10;
})();

export function firePointsAt(t: number): FirePoint[] {
  return FIRE.points.filter((p) => p.arrival <= t);
}

export function hazardAt(t: number): HazardSnapshot {
  const burning = firePointsAt(t);
  return {
    at: t,
    front: burning.length ? burning : t >= FIRE.ignition ? [FIRE.origin] : [],
    burned: [],
    rateOfSpreadKmh: RATE_OF_SPREAD_KMH,
    source: "NASA FIRMS",
  };
}

/** When the model expects fire at a point, from what's been seen: min over spots of (arrival + travel time). */
export function predictedArrival(p: LngLat): number {
  let best = Infinity;
  for (const f of FIRE.points) {
    const t = f.arrival + (haversineKm(p, f) / RATE_OF_SPREAD_KMH) * 3_600_000;
    if (t < best) best = t;
  }
  return best;
}

/**
 * What EvacuAid could know on the night: the worst case, fire running straight
 * from the ignition point at its fastest measured speed. Conservative on purpose,
 * so alerts go out early.
 */
export function forecastArrival(p: LngLat): number {
  return FIRE.ignition + (haversineKm(p, RAW.origin) / RATE_OF_SPREAD_KMH) * 3_600_000;
}

/**
 * What actually happened: when fire reached this spot, from the nearest
 * detections NASA's satellites recorded (30 minutes before the first sighting,
 * plus travel time from it). Ground truth for "was the rescue in time?".
 */
export function actualArrival(p: LngLat): number {
  const ds = RAW.points.map((f) => ({ f, d: haversineKm(p, f) })).sort((a, b) => a.d - b.d);
  const near = ds.filter((x) => x.d <= ds[0].d + 0.3);
  return Math.min(...near.map((x) => x.f.seen - 30 * 60_000 + (x.d / RATE_OF_SPREAD_KMH) * 3_600_000));
}

const PST_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
});

export function clockLabel(t: number): string {
  return PST_FMT.format(new Date(t));
}
