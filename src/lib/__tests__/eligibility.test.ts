import { describe, expect, it } from "vitest";
import { stipendEligibility } from "@/lib/bank/eligibility";

const base = { id: "x1", status: "no_response" as const, alerted: true };

describe("stipend eligibility", () => {
  it("refuses a home with no evacuation order yet", () => {
    expect(stipendEligibility({ ...base, alerted: false }).ok).toBe(false);
  });
  it("allows anyone in an ordered zone, without asking for money", () => {
    expect(stipendEligibility(base).ok).toBe(true);
    expect(stipendEligibility({ ...base, status: "needs_help" }).ok).toBe(true);
  });
  it("refuses people already out", () => {
    expect(stipendEligibility({ ...base, status: "out" }).ok).toBe(false);
  });
  it("fraud personas get through the gate so the bank checks can catch them", () => {
    expect(stipendEligibility({ ...base, id: "h007", status: "out" }).ok).toBe(true);
  });
});
