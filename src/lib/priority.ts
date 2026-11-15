// Who to reach first: a race between the fire and the household.
//
//   A  = when the fire reaches the home. ETA from the satellite-measured spread
//        rate, with lognormal uncertainty: ln A ~ N(ln ETA, σ²), σ = 0.35
//        (the same spread uncertainty the money simulation uses).
//   T  = how long this household needs to get out on its own:
//        mobilization (warning → moving) + travel to safety, longer for
//        wheelchairs, oxygen, kids, pets; no car means waiting for a ride.
//
//   P(trapped) = P(A < T) = Φ((ln T − ln ETA) / σ)
//   V          = harm if trapped = 1 − Π(1 − wᵢ) over independent risk factors
//                (the CDC Social Vulnerability Index variables we can know:
//                 age, disability, medical dependence, children, no vehicle,
//                 limited English)
//   priority   = P(trapped) × V   (expected harm; 0..1)
//
// A van shortens T to the drive time, which is why dispatch follows this order.
// Every factor carries a reason string so the console can show its work.

import { inPolygon, nearestKm } from "./geo";
import type { HazardSnapshot, Household, PriorityResult } from "./types";

/** Spread uncertainty (log scale). 0.35 ≈ the fire arrives anywhere from 0.6× to 1.8× the ETA, 90% of the time. */
export const SIGMA = 0.35;
/** An evacuation order means officials already judged the zone at risk; embers spot ahead of the front. */
export const ORDERED_ZONE_FLOOR = 0.5;

/** Minutes, by component. Tunable; shown to the operator. */
export const T_PARTS = {
  travel: 20, // drive out of the zone
  mobilize: 30, // hear the warning, gather people and meds, leave
  mobility: 60, // wheelchair, walker, bedbound: transfer and loading
  medical: 45, // oxygen, dialysis, power-dependent equipment
  children: 15,
  pets: 10,
  silent: 30, // no reply: may not have heard the warning yet
  age75: 30, // slower to mobilize (profile, before they reply)
  noRide: 240, // no car: waiting for family, a neighbor, or us
  cantLeave: 360, // said they need help: only a rescue gets them out
};

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** P(fire arrives before the household could get out on its own). */
export function pTrapped(etaMin: number, selfEvacMin: number, sigma = SIGMA): number {
  if (!Number.isFinite(etaMin)) return 0;
  if (etaMin <= 0) return 1;
  if (!Number.isFinite(selfEvacMin)) return 1;
  return phi((Math.log(selfEvacMin) - Math.log(etaMin)) / sigma);
}

/** Minutes until the fire front reaches a point, or 0 if already burned. */
export function hazardEtaMin(h: Household, hazard: HazardSnapshot): number {
  if (hazard.burned.some((ring) => inPolygon(h.location, ring))) return 0;
  if (hazard.front.length === 0 || hazard.rateOfSpreadKmh <= 0) return Infinity;
  const km = nearestKm(h.location, hazard.front);
  return (km / hazard.rateOfSpreadKmh) * 60;
}

/** Combine independent risk factors: 1 − Π(1 − wᵢ). */
function combine(weights: number[]): number {
  return 1 - weights.reduce((acc, w) => acc * (1 - w), 1);
}

export function vulnerability(h: Household): { value: number; reasons: string[] } {
  const w: number[] = [];
  const reasons: string[] = [];
  const add = (cond: boolean, weight: number, why: string) => {
    if (cond) {
      w.push(weight);
      reasons.push(`${why} (w ${weight})`);
    }
  };
  add(h.needs.medical, 0.6, "medical dependency");
  add(h.needs.mobility, 0.5, "can't walk without help");
  add(Boolean(h.leftBehind), 0.4, `left at home: ${h.leftBehind}`);
  add(h.profile.age75plus, 0.3, "resident aged 75+");
  add(Boolean(h.doorKnock), 0.3, "silent after 2 texts");
  add(h.needs.children, 0.15, "children in household");
  add(h.language !== "en", 0.1, `primary language: ${h.language}`);
  // Baseline so an unknown household is never zero.
  w.push(0.1);
  return { value: combine(w), reasons };
}

/** Minutes this household needs to get out without us, with the parts that add up. */
export function selfEvacuation(h: Household): { minutes: number; reasons: string[] } {
  const P = T_PARTS;
  if (h.status === "leaving") return { minutes: P.travel, reasons: [`already leaving: ${P.travel} min to safety`] };
  if (h.status === "needs_help") return { minutes: P.cantLeave, reasons: ["asked for help: can't leave on their own"] };

  const hasRide = h.profile.hasCar && !h.needs.noTransport;
  const parts: [boolean, number, string][] = [
    [true, P.mobilize, "get moving"],
    [true, P.travel, "drive out"],
    [h.needs.mobility, P.mobility, "mobility"],
    [h.needs.medical, P.medical, "medical equipment"],
    [h.needs.children, P.children, "children"],
    [h.needs.pets, P.pets, "pets"],
    [h.profile.age75plus && h.status === "no_response", P.age75, "age 75+"],
    [h.status === "no_response" && Boolean(h.alerted), P.silent, "hasn't replied"],
  ];
  let minutes = parts.filter(([on]) => on).reduce((s, [, m]) => s + m, 0);
  const used = parts.filter(([on]) => on).map(([, m, why]) => `${why} ${m}`);
  if (!hasRide) {
    minutes = Math.max(minutes, P.noRide);
    used.push(`no car: wait for a ride ~${P.noRide}`);
  }
  if (h.needs.money) {
    minutes = Math.round(minutes * 1.25);
    used.push("cost is a barrier ×1.25");
  }
  return { minutes, reasons: [`needs ~${minutes} min to leave alone (${used.join(" + ")})`] };
}

export function scoreHousehold(h: Household, hazard: HazardSnapshot): PriorityResult {
  const eta = hazardEtaMin(h, hazard);
  const self = selfEvacuation(h);
  const v = vulnerability(h);
  const fromFire = pTrapped(eta, self.minutes);
  const p = h.alerted ? Math.max(fromFire, ORDERED_ZONE_FLOOR) : fromFire;
  const score = h.status === "out" ? 0 : p * v.value;

  const reasons = [
    Number.isFinite(eta)
      ? eta === 0
        ? `inside burned area (${hazard.source})`
        : `fire front ~${Math.round(eta)} min away (${hazard.source})`
      : "no active hazard nearby",
    ...(h.status === "out" ? ["reported out"] : self.reasons),
    ...(h.alerted && fromFire < ORDERED_ZONE_FLOOR && h.status !== "out" ? ["inside an ordered evacuation zone"] : []),
    ...v.reasons,
  ];
  const lastWords = [...h.messages].reverse().find((m) => m.from === "resident");
  if (lastWords) reasons.push(`said: "${lastWords.text}"`);

  return {
    householdId: h.id,
    score,
    pReach: h.status === "out" ? 0 : p,
    vulnerability: v.value,
    selfEvacMin: h.status === "out" ? 0 : self.minutes,
    etaToHazardMin: Number.isFinite(eta) ? eta : null,
    reasons,
  };
}

export function rankHouseholds(households: Household[], hazard: HazardSnapshot): PriorityResult[] {
  return households
    .map((h) => scoreHousehold(h, hazard))
    .sort((a, b) => b.score - a.score);
}
