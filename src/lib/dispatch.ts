// Dispatch v1: greedy assignment in priority order.
// Each household that needs help gets the nearest vehicle that can carry it
// (wheelchair-capable when needed) and still has seats. The full
// vehicle-routing optimizer replaces this behind the same signature.

import { haversineKm } from "./geo";
import type { Assignment, Household, PriorityResult, Vehicle } from "./types";

export const ROAD_FACTOR = 1.35; // roads are longer than straight lines
export const SPEED_KMH = 30; // evacuation traffic

export function travelMin(a: Vehicle["location"], b: Vehicle["location"]): number {
  return ((haversineKm(a, b) * ROAD_FACTOR) / SPEED_KMH) * 60;
}

export function dispatch(
  ranked: PriorityResult[],
  households: Map<string, Household>,
  vehicles: Vehicle[],
  minScore = 0.05,
): Assignment[] {
  const seats = new Map(vehicles.map((v) => [v.id, v.capacity]));
  const out: Assignment[] = [];

  for (const r of ranked) {
    if (r.score < minScore) continue;
    const h = households.get(r.householdId);
    if (!h || h.status !== "needs_help") continue;

    const riders = Math.max(1, h.needs.people || 1);
    let best: { v: Vehicle; eta: number } | null = null;
    for (const v of vehicles) {
      if ((seats.get(v.id) ?? 0) < riders) continue;
      if (h.needs.mobility && !v.wheelchair) continue;
      const eta = travelMin(v.location, h.location);
      if (!best || eta < best.eta) best = { v, eta };
    }
    if (!best) continue;

    seats.set(best.v.id, (seats.get(best.v.id) ?? 0) - riders);
    out.push({ householdId: h.id, vehicleId: best.v.id, etaMin: Math.round(best.eta) });
  }
  return out;
}
