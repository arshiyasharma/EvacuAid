// Which of your vehicles to suggest, and which are already out. Pure: the
// console runs it every replay minute; the operator always makes the call.

import type { HouseholdView } from "../replay/households";
import { FLEET } from "../replay/fleet";
import type { LngLat } from "../types";
import { driveMin, tripMinutes, type Dispatch } from "./trips";

const MIN = 60_000;

/** vehicleId → the household it's serving, for every vehicle still out. */
export function vehiclesBusy(dispatches: Dispatch[], byId: Map<string, Pick<HouseholdView, "case">>, replayMinute: number) {
  const busy = new Map<string, string>();
  for (const d of dispatches) {
    if (d.live) {
      // Live: out until the resident is checked in at the shelter.
      const st = byId.get(d.householdId)?.case?.status;
      if (st === "dispatched" || st === "onboard") busy.set(d.vehicleId, d.householdId);
    } else if (replayMinute >= d.at && replayMinute < d.at + tripMinutes(d) * MIN) {
      busy.set(d.vehicleId, d.householdId);
    }
  }
  return busy;
}

export type Suggestion = { vehicleId: string; name: string; etaMin: number; wheelchair: boolean } | null;

/** The free vehicle that gets there first (wheelchair-capable when needed). */
export function recommendVehicle(home: LngLat, needsWheelchair: boolean, taken: Set<string>): Suggestion {
  let best: Suggestion = null;
  for (const v of FLEET) {
    if (taken.has(v.id)) continue;
    if (needsWheelchair && !v.wheelchair) continue;
    const eta = driveMin(v.location, home);
    if (!best || eta < best.etaMin) best = { vehicleId: v.id, name: v.name, etaMin: eta, wheelchair: v.wheelchair };
  }
  return best;
}
