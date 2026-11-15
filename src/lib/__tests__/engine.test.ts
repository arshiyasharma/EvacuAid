import { describe, expect, it } from "vitest";
import { dispatch } from "../dispatch";
import { phi, pTrapped, rankHouseholds, scoreHousehold, selfEvacuation } from "../priority";
import { triage } from "../triage";
import type { HazardSnapshot, Household, Needs, Vehicle } from "../types";

const noNeeds: Needs = {
  mobility: false,
  medical: false,
  children: false,
  pets: false,
  noTransport: false,
  money: false,
  people: 1,
};

function house(id: string, lng: number, over: Partial<Household> = {}): Household {
  return {
    id,
    address: `${id} Test St`,
    location: { lng, lat: 34.19 },
    phone: `+1555000${id}`,
    language: "en",
    profile: { age75plus: false, hasCar: true, lowIncome: false },
    status: "no_response",
    needs: { ...noNeeds },
    messages: [],
    lastUpdate: 0,
    ...over,
  };
}

// Fire front sits at lng -118.10, moving west at 2 km/h.
const hazard: HazardSnapshot = {
  at: 0,
  front: [{ lng: -118.1, lat: 34.19 }],
  burned: [],
  rateOfSpreadKmh: 2,
  source: "test",
};

describe("race model", () => {
  it("phi is the standard normal CDF", () => {
    expect(phi(0)).toBeCloseTo(0.5, 6);
    expect(phi(1.959964)).toBeCloseTo(0.975, 4);
    expect(phi(-1.644854)).toBeCloseTo(0.05, 4);
  });

  it("P(trapped) is 0.5 when the fire and the household tie, and moves the right way", () => {
    expect(pTrapped(60, 60)).toBeCloseTo(0.5, 6);
    expect(pTrapped(30, 60)).toBeGreaterThan(0.95); // fire twice as fast as they can leave
    expect(pTrapped(240, 50)).toBeLessThan(0.001); // plenty of time
    expect(pTrapped(0, 50)).toBe(1); // already burning
    expect(pTrapped(Infinity, 50)).toBe(0); // no fire
  });

  it("a wheelchair user without a car needs far longer than a driver", () => {
    const driver = selfEvacuation(house("d", -118.12));
    const chair = selfEvacuation(
      house("c", -118.12, { needs: { ...noNeeds, mobility: true, noTransport: true }, profile: { age75plus: true, hasCar: false, lowIncome: false } }),
    );
    expect(driver.minutes).toBe(50);
    expect(chair.minutes).toBeGreaterThanOrEqual(240);
  });
});

describe("scoreHousehold", () => {
  it("scores zero once a household is out", () => {
    const h = house("a", -118.11, { status: "out" });
    expect(scoreHousehold(h, hazard).score).toBe(0);
  });

  it("ranks a closer, wheelchair-bound resident with no car above a mobile driver", () => {
    const vulnerable = house("v", -118.12, {
      status: "needs_help",
      needs: { ...noNeeds, mobility: true, noTransport: true },
      profile: { age75plus: true, hasCar: false, lowIncome: true },
    });
    const driver = house("d", -118.12, { status: "leaving" });
    const ranked = rankHouseholds([driver, vulnerable], hazard);
    expect(ranked[0].householdId).toBe("v");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score * 5);
  });

  it("gives every score its reasons, including the resident's own words", () => {
    const h = house("q", -118.12, {
      status: "needs_help",
      messages: [{ at: 1, from: "resident", text: "my mom can't walk" }],
    });
    const r = scoreHousehold(h, hazard);
    expect(r.reasons.join(" ")).toContain("my mom can't walk");
    expect(r.reasons[0]).toMatch(/fire front ~\d+ min away/);
  });
});

describe("triage", () => {
  it("reads the menu numbers", () => {
    expect(triage("1").status).toBe("out");
    expect(triage("2").status).toBe("leaving");
    expect(triage("3").status).toBe("needs_help");
  });

  it("turns free text into needs", () => {
    const r = triage("my mom can't walk and the car's in the shop, 3 of us");
    expect(r.status).toBe("needs_help");
    expect(r.needs.mobility).toBe(true);
    expect(r.needs.noTransport).toBe(true);
    expect(r.needs.people).toBe(3);
  });

  it("flags money as a barrier", () => {
    expect(triage("we can't afford a hotel").needs.money).toBe(true);
  });
});

describe("dispatch", () => {
  const vehicles: Vehicle[] = [
    { id: "van1", kind: "van", capacity: 6, location: { lng: -118.13, lat: 34.19 }, wheelchair: false },
    { id: "para1", kind: "paratransit", capacity: 2, location: { lng: -118.16, lat: 34.19 }, wheelchair: true },
  ];

  it("sends a wheelchair-capable vehicle to a mobility need even if it is farther", () => {
    const h = house("w", -118.125, {
      status: "needs_help",
      needs: { ...noNeeds, mobility: true, noTransport: true },
      profile: { age75plus: true, hasCar: false, lowIncome: false },
    });
    const ranked = rankHouseholds([h], hazard);
    const [a] = dispatch(ranked, new Map([[h.id, h]]), vehicles);
    expect(a.vehicleId).toBe("para1");
  });

  it("does not overfill a vehicle", () => {
    const hs = ["1", "2", "3"].map((id) =>
      house(id, -118.12, {
        status: "needs_help",
        needs: { ...noNeeds, noTransport: true, people: 3 },
        profile: { age75plus: false, hasCar: false, lowIncome: false },
      }),
    );
    const ranked = rankHouseholds(hs, hazard);
    const assigned = dispatch(ranked, new Map(hs.map((h) => [h.id, h])), vehicles);
    const van = assigned.filter((a) => a.vehicleId === "van1");
    expect(van.length).toBe(2); // 6 seats / 3 riders
  });
});

describe("ordered zone floor", () => {
  it("never lets an alerted household's hazard probability fall below the zone floor", () => {
    const far = { ...hazard, front: [{ lng: -117.5, lat: 34.19 }] }; // fire ~55 km away
    const h = house("z", -118.12, { status: "needs_help", alerted: true });
    const r = scoreHousehold(h, far);
    expect(r.pReach).toBe(0.5);
    expect(r.reasons).toContain("inside an ordered evacuation zone");
  });
});
