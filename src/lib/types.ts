// Core domain types for EvacuAid.

export type LngLat = { lng: number; lat: number };

/** What a household has told us (or what we assume before they reply). */
export type Status = "no_response" | "out" | "leaving" | "needs_help";

/** Structured needs extracted from a resident's reply. */
export type Needs = {
  mobility: boolean; // wheelchair, can't walk, bedbound
  medical: boolean; // oxygen, dialysis, medication-dependent
  children: boolean;
  pets: boolean;
  noTransport: boolean; // no car, car broken, no driver
  money: boolean; // can't afford gas / hotel
  people: number; // people needing a ride
};

export type Household = {
  id: string;
  address: string;
  location: LngLat;
  phone: string;
  language: string;
  /** What the registry/census-style profile says before anyone replies. */
  profile: {
    age75plus: boolean;
    hasCar: boolean;
    lowIncome: boolean;
  };
  status: Status;
  needs: Needs;
  /** Raw messages, newest last, so every decision can quote the resident. */
  messages: { at: number; from: "resident" | "evacuaid"; text: string }[];
  lastUpdate: number;
  /** True once the household is inside a zone that received an evacuation alert. */
  alerted?: boolean;
  /** No reply after repeated texts: a responder should knock. */
  doorKnock?: boolean;
  /** Someone (or a pet) still inside, reported by the resident. */
  leftBehind?: string;
};

/** A hazard front at a moment in time: points on the fire edge plus spread rate. */
export type HazardSnapshot = {
  at: number; // epoch ms
  front: LngLat[]; // points on the active fire edge
  burned: LngLat[][]; // polygons already burned
  rateOfSpreadKmh: number;
  source: string; // where this snapshot came from (data id or "reconstruction")
};

export type Vehicle = {
  id: string;
  kind: "van" | "paratransit" | "volunteer";
  capacity: number;
  location: LngLat;
  wheelchair: boolean;
};

export type Assignment = {
  householdId: string;
  vehicleId: string;
  etaMin: number;
};

export type PriorityResult = {
  householdId: string;
  score: number; // 0..1
  /** P(trapped): chance the fire arrives before they could leave on their own. */
  pReach: number;
  vulnerability: number;
  /** Minutes they need to get out without help. */
  selfEvacMin: number;
  etaToHazardMin: number | null;
  reasons: string[];
};
