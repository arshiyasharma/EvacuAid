// What the operator did tonight: dispatches, messages, and the county's
// operations bills. Live residents get real texts; simulated residents get the
// same story overlaid on the replay at the moment the operator acted.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { FLEET, SHELTER } from "../replay/fleet";
import type { LngLat } from "../types";

import { driveMin, type Bill, type Dispatch, type OpsMessage } from "./trips";
export { driveMin, tripMinutes, type Bill, type Dispatch, type OpsMessage } from "./trips";

type State = { dispatches: Map<string, Dispatch>; messages: OpsMessage[]; bills: Bill[]; version: number };
const g = globalThis as unknown as { __evacuaidOps?: State };
const OPS_FILE = "data/ops-state.json";
function load(): State {
  try {
    if (existsSync(OPS_FILE)) {
      const j = JSON.parse(readFileSync(OPS_FILE, "utf8")) as { dispatches: Dispatch[]; messages: OpsMessage[]; bills: Bill[]; version: number };
      return { dispatches: new Map(j.dispatches.map((d) => [d.householdId, d])), messages: j.messages, bills: j.bills, version: j.version ?? 0 };
    }
  } catch {
    // start clean
  }
  return { dispatches: new Map(), messages: [], bills: [], version: 0 };
}
const state: State = (g.__evacuaidOps ??= load());
/** Every operator action bumps this, so consoles watching the feed refresh. */
function changed() {
  state.version++;
  try {
    mkdirSync("data", { recursive: true });
    writeFileSync(OPS_FILE, JSON.stringify({ dispatches: [...state.dispatches.values()], messages: state.messages, bills: state.bills, version: state.version }));
  } catch {
    // keep in memory
  }
}

export function recordDispatch(d: Dispatch) {
  state.dispatches.set(d.householdId, d);
  changed();
}
export function recordBill(b: Bill) {
  state.bills.unshift(b);
  changed();
}
export function recordMessage(m: OpsMessage) {
  state.messages.push(m);
  changed();
}

export function opsSnapshot() {
  return { dispatches: [...state.dispatches.values()], messages: state.messages, bills: state.bills, version: state.version };
}

export function resetOps() {
  state.dispatches.clear();
  state.messages.length = 0;
  state.bills.length = 0;
  changed();
}

export function vehicle(id: string) {
  return FLEET.find((v) => v.id === id) ?? null;
}

export function planTrip(vehicleId: string, home: LngLat) {
  const v = vehicle(vehicleId);
  if (!v) throw new Error("Unknown vehicle");
  return { v, etaMin: driveMin(v.location, home), toShelterMin: driveMin(home, SHELTER.location) };
}
