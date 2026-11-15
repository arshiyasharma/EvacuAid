// Nobody gets money because an operator clicked a house. A stipend needs an
// active situation: the home is inside an evacuation zone that has been ordered
// at this moment of the night, and the household hasn't already reported out.
// The bank checks then test whether the claim is true. Pure, so the console
// shows the same answer the server enforces.

import type { Household } from "../types";

/** Demo fraud personas: they claim to be stuck at home (the claim the bank checks disprove). */
export const PERSONA_CLAIMS: Record<string, string> = {
  h007: "says stuck at home",
  h113: "says stuck at home",
  h241: "says stuck at home",
  h019: "says no car",
  h088: "says no car",
};

export type Eligibility = { ok: boolean; reasons: { ok: boolean; text: string }[] };

type Shape = Pick<Household, "id" | "status" | "alerted">;

export function stipendEligibility(h: Shape): Eligibility {
  const claim = PERSONA_CLAIMS[h.id];
  const out = !claim && h.status === "out";
  const reasons = [
    {
      ok: Boolean(h.alerted),
      text: h.alerted ? "Inside an ordered evacuation zone" : "No evacuation order here yet",
    },
    {
      ok: !out,
      text: out ? "Already reported out safe" : claim ? `Resident ${claim}` : "Still at home or leaving",
    },
  ];
  return { ok: reasons.every((r) => r.ok), reasons };
}
