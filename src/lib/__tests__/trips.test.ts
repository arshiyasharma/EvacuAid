import { describe, expect, it } from "vitest";
import { vehicleAt } from "../ops/trips";

const base = { lng: 0, lat: 0 };
const home = { lng: 1, lat: 0 };
const shelter = { lng: 1, lat: 1 };
const MIN = 60_000;
const trip = { etaMin: 10, toShelterMin: 20, at: 0, live: false };

describe("vehicleAt", () => {
  it("drives to the home, loads, drives to the shelter, comes back", () => {
    expect(vehicleAt(trip, base, home, shelter, 5 * MIN)).toMatchObject({ phase: "to_home", at: { lng: 0.5, lat: 0 }, target: home });
    expect(vehicleAt(trip, base, home, shelter, 12 * MIN)).toMatchObject({ phase: "loading", at: home, target: shelter });
    expect(vehicleAt(trip, base, home, shelter, 26 * MIN)).toMatchObject({ phase: "to_shelter", at: { lng: 1, lat: 0.5 } });
    expect(vehicleAt(trip, base, home, shelter, 46 * MIN).phase).toBe("returning");
    expect(vehicleAt(trip, base, home, shelter, 70 * MIN)).toMatchObject({ phase: "idle", at: base, target: null });
  });

  it("is at base before the trip starts (replay scrubbed backwards)", () => {
    expect(vehicleAt({ ...trip, at: 100 * MIN }, base, home, shelter, 50 * MIN)).toMatchObject({ phase: "idle", at: base });
  });

  it("runs live trips on demo time, in step with the resident's texts", () => {
    const live = { etaMin: 3, toShelterMin: 8, at: 0, live: true };
    // 10 s per trip-minute; each leg at least 5 minutes: 50 s there, 50 s loading, 80 s to the shelter.
    expect(vehicleAt(live, base, home, shelter, 25_000).phase).toBe("to_home");
    expect(vehicleAt(live, base, home, shelter, 60_000).phase).toBe("loading");
    expect(vehicleAt(live, base, home, shelter, 120_000).phase).toBe("to_shelter");
  });
});
