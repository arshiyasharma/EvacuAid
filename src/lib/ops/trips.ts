// Trip math and shared types. Pure: safe for the browser (the console uses it),
// unlike actions.ts, which saves operator actions to disk on the server.

import { haversineKm } from "../geo";
import type { LngLat } from "../types";

export type Dispatch = {
  householdId: string;
  vehicleId: string;
  vehicleName: string;
  etaMin: number;
  toShelterMin: number;
  live: boolean;
  /** Real time for live residents; replay time for simulated ones. */
  at: number;
  billCents: number;
  billTx?: string;
};

export type OpsMessage = { householdId: string; at: number; text: string };
export type Bill = { at: number; householdId: string; label: string; cents: number; transactionId?: string; vehicleName: string };

const ROAD = 1.35;
const KMH = 30;
export const driveMin = (a: LngLat, b: LngLat) => Math.max(2, Math.round(((haversineKm(a, b) * ROAD) / KMH) * 60));

/** Minutes a dispatched vehicle is tied up: drive there, load, drive to the shelter, come back. */
export const tripMinutes = (d: Pick<Dispatch, "etaMin" | "toShelterMin">) => d.etaMin + 6 + d.toShelterMin * 2;

/** Live trips run on demo time: this many real seconds per trip-minute (server timers use the same). */
export const DEMO_SECONDS_PER_MIN_DEFAULT = 10;
const LOAD_MIN = 6;

export type TripPhase = "to_home" | "loading" | "to_shelter" | "returning" | "idle";

const lerp = (a: LngLat, b: LngLat, t: number): LngLat => {
  const k = Math.min(1, Math.max(0, t));
  return { lng: a.lng + (b.lng - a.lng) * k, lat: a.lat + (b.lat - a.lat) * k };
};

/**
 * Where a dispatched vehicle is right now, and where it's headed.
 * Replay trips use replay milliseconds; live trips use real milliseconds on demo time,
 * matching the resident's texts (each leg at least 5 trip-minutes, 2 minutes to load).
 */
export function vehicleAt(
  d: Pick<Dispatch, "etaMin" | "toShelterMin" | "at" | "live">,
  base: LngLat,
  home: LngLat,
  shelter: LngLat,
  now: number,
  demoSecondsPerMin = DEMO_SECONDS_PER_MIN_DEFAULT,
): { at: LngLat; phase: TripPhase; target: LngLat | null } {
  const legs = d.live
    ? [Math.max(5, d.etaMin), Math.max(5, 2), Math.max(5, d.toShelterMin), Math.max(5, d.toShelterMin)].map((m) => m * demoSecondsPerMin * 1000)
    : [d.etaMin, LOAD_MIN, d.toShelterMin, d.toShelterMin].map((m) => m * 60_000);
  let t = now - d.at;
  if (t < 0) return { at: base, phase: "idle", target: null };
  if (t < legs[0]) return { at: lerp(base, home, t / legs[0]), phase: "to_home", target: home };
  t -= legs[0];
  if (t < legs[1]) return { at: home, phase: "loading", target: shelter };
  t -= legs[1];
  if (t < legs[2]) return { at: lerp(home, shelter, t / legs[2]), phase: "to_shelter", target: shelter };
  t -= legs[2];
  if (t < legs[3]) return { at: lerp(shelter, base, t / legs[3]), phase: "returning", target: null };
  return { at: base, phase: "idle", target: null };
}
