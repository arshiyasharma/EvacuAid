// Simulated households in west Altadena for the Eaton replay.
// Every person and message here is fictional. Streets are real.
//
// Each household gets a whole conversation with EvacuAid, in English or
// Spanish, using the same texts the live system sends. West Altadena is split
// into sectors: ten cases land in YOUR sector and wait for you; other
// operators (and their vehicles) work the rest, and their rescues play out on
// the replay so the night actually resolves.

import { AID_TEXT, ALERT, T, usd, type AidSize, type Case } from "../agent/conversation";
import { haversineKm } from "../geo";
import { rng } from "../rng";
import type { Household, LngLat, Needs, Status } from "../types";
import { actualArrival, FIRE, forecastArrival } from "./eaton";
import { SHELTER } from "./fleet";

const STREETS = [
  "Lincoln Ave",
  "Woodbury Rd",
  "Altadena Dr",
  "Mendocino St",
  "Calaveras St",
  "Ventura St",
  "Marengo Ave",
  "Fair Oaks Ave",
  "Mariposa St",
  "Palm St",
  "Holliston Ave",
  "Figueroa Dr",
  "Morada Pl",
  "Loma Alta Dr",
  "El Molino Ave",
  "Monterey Rd",
];

// West Altadena, roughly Lincoln Ave to Lake Ave.
const BOUNDS = { west: -118.168, east: -118.132, south: 34.178, north: 34.205 };
export const HOUSEHOLD_COUNT = 420;
/** Cases in the demo operator's own sector. */
export const SECTOR_SIZE = 10;

/** Minutes of warning EvacuAid aims for before predicted fire arrival. */
export const ALERT_LEAD_MIN = 120;

const NO_NEEDS: Needs = {
  mobility: false,
  medical: false,
  children: false,
  pets: false,
  noTransport: false,
  money: false,
  people: 1,
};

export type SimCase = Pick<Case, "kind" | "status" | "aid" | "people" | "wheelchair" | "medical" | "vehicleName" | "etaMin"> & {
  handledBy?: string;
};

export type ReplayEvent = {
  at: number;
  householdId: string;
  kind: "alert" | "msg" | "status";
  from?: "resident" | "evacuaid";
  text?: string;
  status?: Status;
  needs?: Partial<Needs>;
  summary?: string;
  leftBehind?: string;
  doorKnock?: boolean;
  language?: string;
  case?: Partial<SimCase>;
};

export type SimHousehold = Household & {
  /** When fire actually reached this address (from NASA's satellite detections). */
  fireEta: number;
  /** When EvacuAid alerts it: two hours before the worst-case forecast, knowable on the night. */
  alertAt: number;
  /** "you": the demo operator's sector. "other": handled by other operators. */
  sector: "you" | "other";
  story: string;
};

const random = rng(2025);
const pick = <T,>(arr: T[]) => arr[Math.floor(random() * arr.length)];
const MIN = 60_000;

// ---- other sectors' fleet (yours is FLEET in fleet.ts) ----------------------

type OtherVehicle = { name: string; wheelchair: boolean; pos: LngLat; freeAt: number };
export const OTHER_FLEET: Omit<OtherVehicle, "freeAt">[] = [
  { name: "Paratransit 4", wheelchair: true, pos: { lng: -118.166, lat: 34.181 } },
  { name: "Paratransit 5", wheelchair: true, pos: { lng: -118.134, lat: 34.203 } },
  { name: "Paratransit 6", wheelchair: true, pos: { lng: -118.151, lat: 34.2 } },
  { name: "Paratransit 7", wheelchair: true, pos: { lng: -118.14, lat: 34.183 } },
  { name: "Van 6", wheelchair: false, pos: { lng: -118.16, lat: 34.199 } },
  { name: "Van 7", wheelchair: false, pos: { lng: -118.146, lat: 34.19 } },
  { name: "Van 8", wheelchair: false, pos: { lng: -118.155, lat: 34.183 } },
  { name: "Van 9", wheelchair: false, pos: { lng: -118.137, lat: 34.196 } },
  { name: "Van 10", wheelchair: false, pos: { lng: -118.163, lat: 34.191 } },
  { name: "County bus 1", wheelchair: true, pos: { lng: -118.149, lat: 34.179 } },
  { name: "CERT team 3", wheelchair: false, pos: { lng: -118.158, lat: 34.204 } },
  { name: "CERT team 4", wheelchair: false, pos: { lng: -118.143, lat: 34.2 } },
];
const OTHER_OPERATORS = ["Operator Diaz", "Operator Kim", "Operator Okafor", "Operator Reyes"];
const drive = (a: LngLat, b: LngLat) => Math.max(2, Math.round(((haversineKm(a, b) * 1.35) / 30) * 60));

// ---- conversation builder ---------------------------------------------------

type Lang = "en" | "es";

function convo(id: string, start: number) {
  let t = start;
  const ev: ReplayEvent[] = [];
  const push = (from: "resident" | "evacuaid", text: string, patch: Partial<ReplayEvent>) =>
    ev.push({ at: t, householdId: id, kind: "msg", from, text, ...patch });
  return {
    ev,
    now: () => t,
    wait: (m: number) => (t += m * MIN),
    /** The resident writes, a little while after the last message. */
    r(text: string, patch: Partial<ReplayEvent> = {}, gap = 1 + random() * 3) {
      t += gap * MIN;
      push("resident", text, patch);
    },
    /** EvacuAid answers within seconds. */
    e(text: string, patch: Partial<ReplayEvent> = {}) {
      t += 0.2 * MIN;
      push("evacuaid", text, patch);
    },
  };
}
type C = ReturnType<typeof convo>;

const rideCase = (people: number, wheelchair = false, medical = false): ReplayEvent["case"] => ({ kind: "ride", status: "review", people, wheelchair, medical });
const aidCase = (aid: AidSize): ReplayEvent["case"] => ({ kind: "aid", status: "review", aid });

/** Arrived safely later: "1" → anyone left? → no → safe. */
function arrives(c: C, l: Lang, after: number, says = l === "es" ? "1 ya llegamos" : "1 made it") {
  c.wait(after);
  c.r(says, { status: "out" });
  c.e(T.out[l]);
  c.r(l === "es" ? "no" : "n");
  c.e(T.outDone[l], { status: "out", summary: "Arrived safely" });
}

type Story = { name: string; lang: Lang; kind: "safe" | "ride" | "aid" | "check"; play: (c: C) => void };

const STORIES: Record<string, Story> = {
  safe_quick: {
    name: "Out, nobody left",
    lang: "en",
    kind: "safe",
    play: (c) => {
      c.r("1", { status: "out" });
      c.e(T.out.en);
      c.r("N");
      c.e(T.outDone.en, { summary: "Out, nobody left behind" });
    },
  },
  safe_sister: {
    name: "Already at family",
    lang: "en",
    kind: "safe",
    play: (c) => {
      c.r("1 already at my sister's in Pasadena", { status: "out" });
      c.e(T.out.en);
      c.r("no, the cat's with me");
      c.e(T.outDone.en, { summary: "At family in Pasadena", needs: { pets: true } });
    },
  },
  leaving_place: {
    name: "Leaving, has a place",
    lang: "en",
    kind: "safe",
    play: (c) => {
      c.r("2", { status: "leaving" });
      c.e(T.leaving.en);
      c.r("A");
      c.e(T.leavingHasPlace.en, { summary: "Leaving, has a place" });
      arrives(c, "en", 25 + random() * 30);
    },
  },
  leaving_dogs: {
    name: "Leaving with dogs to the shelter",
    lang: "en",
    kind: "safe",
    play: (c) => {
      c.r("2, taking the dogs", { status: "leaving", needs: { pets: true } });
      c.e(T.leaving.en);
      c.r("B");
      c.e(T.leavingShelter.en, { summary: "Leaving with dogs → shelter" });
      arrives(c, "en", 30 + random() * 25, "1 we're at the civic center");
    },
  },
  leaving_es: {
    name: "Saliendo (Spanish)",
    lang: "es",
    kind: "safe",
    play: (c) => {
      c.r("2 ya vamos saliendo", { status: "leaving", language: "es" });
      c.e(T.leaving.es);
      c.r("A");
      c.e(T.leavingHasPlace.es, { summary: "Saliendo, tiene a dónde ir" });
      arrives(c, "es", 30 + random() * 25);
    },
  },
  scam_check: {
    name: "Asks if it's a scam",
    lang: "en",
    kind: "safe",
    play: (c) => {
      c.r("is this real? how do i know this isn't a scam");
      c.e(
        "This is EvacuAid, working with LA County for this evacuation. We will NEVER ask for money, passwords or card numbers.\n\nAre you out, leaving, or do you need help? Reply 1, 2 or 3.",
        { summary: "Asked if the alert is real" },
      );
      c.r("2", { status: "leaving" });
      c.e(T.leaving.en);
      c.r("A");
      c.e(T.leavingHasPlace.en, { summary: "Leaving, has a place" });
      arrives(c, "en", 30 + random() * 20);
    },
  },
  horses: {
    name: "Won't leave the horses",
    lang: "en",
    kind: "safe",
    play: (c) => {
      c.r("I'm not leaving without my horses");
      c.e(
        "We understand. Please don't wait for the fire to reach you.\n\nIf you need help moving them, reply 3 and an operator will see what we can send. If you're leaving, reply 2.",
        { summary: "Won't leave without horses" },
      );
      c.r("2 neighbor has a trailer, loading now", { status: "leaving", needs: { pets: true } });
      c.e(T.leaving.en);
      c.r("A");
      c.e(T.leavingHasPlace.en, { summary: "Leaving with horses (neighbor's trailer)" });
      arrives(c, "en", 40 + random() * 20);
    },
  },
  neighbor: {
    name: "Out, neighbor left behind",
    lang: "en",
    kind: "ride",
    play: (c) => {
      c.r("1", { status: "out" });
      c.e(T.out.en);
      c.r("Y");
      c.e(T.outWho.en, { status: "needs_help", leftBehind: "someone still at home" });
      c.r("my neighbor Mr. Lee next door, he's 88 and doesn't drive");
      c.e(
        "Thank you. We've added Mr. Lee to the rescue list and an emergency operator is confirming a vehicle for him NOW.\n\nIf it's safe, knock on his door and tell him to wait by the front with a phone.",
        { leftBehind: "neighbor, 88, alone, no car", needs: { noTransport: true }, summary: "Out · neighbor (88, alone, no car) left behind", case: rideCase(1) },
      );
    },
  },
  ride_wheelchair: {
    name: "Wheelchair, uses the menu",
    lang: "en",
    kind: "ride",
    play: (c) => {
      c.r("3", { status: "needs_help" });
      c.e(T.help.en);
      c.r("A", { needs: { mobility: true } });
      c.e(T.helpPeople.en);
      c.r("2");
      c.e(T.rideReview.en(2, true), { needs: { people: 2, noTransport: true }, summary: "Needs a ride: 2 people, wheelchair", case: rideCase(2, true) });
    },
  },
  ride_mom: {
    name: "Mom can't walk (free text)",
    lang: "en",
    kind: "ride",
    play: (c) => {
      c.r("my mom can't walk and the car's in the shop", { status: "needs_help", needs: { mobility: true, noTransport: true } });
      c.e("I'm sorry, we're getting help to you. How many people need a ride, including you? Reply a number, and tell us about pets.");
      c.r("2 of us");
      c.e(T.rideReview.en(2, true), { needs: { people: 2 }, summary: "Mother can't walk, car broken, 2 people", case: rideCase(2, true) });
    },
  },
  ride_oxygen_es: {
    name: "Abuela con oxígeno (Spanish)",
    lang: "es",
    kind: "ride",
    play: (c) => {
      c.r("somos 4, mi abuela usa oxígeno y no tenemos carro", {
        status: "needs_help",
        language: "es",
        needs: { medical: true, noTransport: true, people: 4 },
      });
      c.e(`Gracias por avisarnos. Lleven el oxígeno y las medicinas de su abuela.\n\n${T.rideReview.es(4, false)}`, {
        summary: "4 personas, abuela con oxígeno, sin carro",
        case: rideCase(4, false, true),
      });
      c.r("gracias, estamos listos en la puerta");
      c.e(T.stillHere.es);
    },
  },
  ride_father_es: {
    name: "Papá no puede caminar (Spanish)",
    lang: "es",
    kind: "ride",
    play: (c) => {
      c.r("3", { status: "needs_help", language: "es" });
      c.e(T.help.es);
      c.r("A", { needs: { mobility: true } });
      c.e(T.helpPeople.es);
      c.r("dos");
      c.e(T.rideReview.es(2, true), { needs: { people: 2, noTransport: true }, summary: "Papá no puede caminar, 2 personas", case: rideCase(2, true) });
    },
  },
  ride_blocked: {
    name: "Road blocked by fire",
    lang: "en",
    kind: "ride",
    play: (c) => {
      c.r("fire is at the end of our street and the road out is blocked, 3 of us", {
        status: "needs_help",
        needs: { noTransport: true, people: 3 },
      });
      c.e(`🚨 CALL 911 NOW if you're in immediate danger.\n\n${T.rideReview.en(3, false)}`, {
        summary: "🚨 Road blocked by fire, 3 people trapped",
        case: rideCase(3),
      });
    },
  },
  dialysis: {
    name: "Dialysis, ride not answering",
    lang: "en",
    kind: "ride",
    play: (c) => {
      c.r("dialysis patient, my ride isn't answering", { status: "needs_help", needs: { medical: true, noTransport: true } });
      c.e("We're on it. Bring your medication list and any supplies you need tonight.\n\nHow many people need a ride, including you?");
      c.r("just me");
      c.e(T.rideReview.en(1, false), { summary: "Dialysis patient, no ride, 1 person", case: rideCase(1, false, true) });
    },
  },
  aid_room: {
    name: "Has a car, can't afford a room",
    lang: "en",
    kind: "aid",
    play: (c) => {
      c.r("2", { status: "leaving" });
      c.e(T.leaving.en);
      c.r("C", { needs: { money: true } });
      c.e(T.aidCar.en, { case: { kind: "aid", status: "gathering" } });
      c.r("y");
      c.e(T.aidDest.en);
      c.r("C");
      c.e(T.aidReview.en(AID_TEXT.night.en, usd(AID_TEXT.night.cents)), {
        summary: `Has a car, needs a room · suggest ${usd(AID_TEXT.night.cents)}`,
        case: aidCase("night"),
      });
    },
  },
  aid_gas: {
    name: "Needs gas money to reach family",
    lang: "en",
    kind: "aid",
    play: (c) => {
      c.r("we need money for gas", { status: "needs_help", needs: { money: true } });
      c.e(`We can help with that.\n\n${T.aidCar.en}`, { case: { kind: "aid", status: "gathering" } });
      c.r("yes");
      c.e(T.aidDest.en);
      c.r("B, my brother's in Glendale");
      c.e(T.aidReview.en(AID_TEXT.gas.en, usd(AID_TEXT.gas.cents)), { summary: `Has a car, going to family · suggest ${usd(AID_TEXT.gas.cents)}`, case: aidCase("gas") });
    },
  },
  aid_gas_es: {
    name: "Sin dinero para gasolina (Spanish)",
    lang: "es",
    kind: "aid",
    play: (c) => {
      c.r("no tenemos dinero para gasolina", { status: "needs_help", language: "es", needs: { money: true } });
      c.e(`Podemos ayudar con eso.\n\n${T.aidCar.es}`, { case: { kind: "aid", status: "gathering" } });
      c.r("sí");
      c.e(T.aidDest.es);
      c.r("A");
      c.e(T.aidReview.es(AID_TEXT.gas.es, usd(AID_TEXT.gas.cents)), { summary: `Tiene carro, va al refugio · sugerido ${usd(AID_TEXT.gas.cents)}`, case: aidCase("gas") });
    },
  },
  money_no_car: {
    name: "Asks for money, really needs a ride",
    lang: "en",
    kind: "ride",
    play: (c) => {
      c.r("can you send money for gas", { status: "needs_help", needs: { money: true } });
      c.e(`We can help with that.\n\n${T.aidCar.en}`, { case: { kind: "aid", status: "gathering" } });
      c.r("no our car is dead");
      c.e(T.aidNoCar.en, { needs: { noTransport: true } });
      c.r("3 and a dog");
      c.e(T.rideReview.en(3, false), { needs: { people: 3, pets: true }, summary: "Car dead · needs a ride, 3 people + dog", case: rideCase(3) });
    },
  },
};

const SAFE = ["safe_quick", "safe_sister", "leaving_place", "leaving_dogs", "scam_check", "horses"];
const HELP_EN = ["ride_wheelchair", "ride_mom", "ride_blocked", "dialysis", "neighbor", "money_no_car", "aid_room", "aid_gas"];
const HELP_ES = ["ride_oxygen_es", "ride_father_es", "aid_gas_es"];

function storyFor(profile: SimHousehold["profile"], spanish: boolean): string {
  const vulnerable = profile.age75plus || !profile.hasCar || profile.lowIncome;
  if (vulnerable && random() < 0.5) {
    if (spanish) return pick(HELP_ES);
    if (profile.hasCar && profile.lowIncome && random() < 0.5) return pick(["aid_room", "aid_gas"]);
    return pick(HELP_EN.filter((s) => !s.startsWith("aid")));
  }
  return spanish ? "leaving_es" : pick(SAFE);
}

// ---- the night --------------------------------------------------------------

function buildHouseholds(): { households: SimHousehold[]; events: ReplayEvent[] } {
  const households: SimHousehold[] = [];
  const events: ReplayEvent[] = [];
  /** Cases that open on the replay: [household, when the case went to review, the case]. */
  const opened: { h: SimHousehold; at: number; c: Partial<SimCase> }[] = [];

  for (let i = 0; i < HOUSEHOLD_COUNT; i++) {
    const location = {
      lng: BOUNDS.west + random() * (BOUNDS.east - BOUNDS.west),
      lat: BOUNDS.south + random() * (BOUNDS.north - BOUNDS.south),
    };
    const age75plus = random() < 0.17;
    const hasCar = random() < (age75plus ? 0.6 : 0.88);
    const lowIncome = random() < 0.3;
    const spanish = random() < 0.14;
    const fireEta = actualArrival(location);
    const alertAt = Math.max(FIRE.ignition + 25 * MIN, forecastArrival(location) - ALERT_LEAD_MIN * MIN);
    const id = `h${String(i + 1).padStart(3, "0")}`;
    const profile = { age75plus, hasCar, lowIncome };

    const h: SimHousehold = {
      id,
      address: `${100 + Math.floor(random() * 2800)} ${pick(STREETS)}`,
      location,
      phone: `+1626555${String(1000 + i).slice(-4)}`,
      language: spanish ? "es" : "en",
      profile,
      status: "no_response",
      needs: { ...NO_NEEDS },
      messages: [],
      lastUpdate: 0,
      fireEta,
      alertAt,
      sector: "other",
      story: "silent",
    };
    households.push(h);
    events.push({ at: alertAt, householdId: id, kind: "alert" });

    const l: Lang = spanish ? "es" : "en";
    // Silent households: two nudges, then a door knock.
    const silentChance = age75plus ? 0.3 : 0.14;
    if (random() < silentChance) {
      const c = convo(id, alertAt);
      c.wait(35);
      c.e(T.nudge1[l]);
      if (random() < 0.35) {
        h.story = "silent_then_answers";
        c.r(l === "es" ? "perdón estaba dormido, ya salimos" : "sorry was asleep, leaving now", { status: "leaving" }, 6 + random() * 10);
        c.e(T.leaving[l]);
        c.r("A");
        c.e(T.leavingHasPlace[l], { summary: "Answered late, leaving" });
        arrives(c, l, 30 + random() * 20);
      } else {
        h.story = "silent";
        c.wait(35);
        c.e(T.nudge2[l], { doorKnock: true, summary: "No reply after 2 texts · door knock", case: { kind: "check", status: "review" } });
        opened.push({ h, at: c.now(), c: { kind: "check", people: 1 } });
      }
      events.push(...c.ev);
      continue;
    }

    const key = storyFor(profile, spanish);
    const story = STORIES[key];
    h.story = key;
    const c = convo(id, alertAt + (1 + random() * 20) * MIN);
    story.play(c);
    events.push(...c.ev);
    const review = c.ev.find((e) => e.case?.status === "review");
    if (review) opened.push({ h, at: review.at, c: review.case! });
  }

  // Your sector: ten cases spread through the night (rides, aid, a door knock).
  const byTime = [...opened].sort((a, b) => a.at - b.at);
  const want = { ride: 6, aid: 3, check: 1 };
  const mine = new Set<string>();
  const stride = Math.max(1, Math.floor(byTime.length / 30));
  for (let i = 0; i < byTime.length && mine.size < SECTOR_SIZE; i += stride) {
    const k = byTime[i].c.kind as keyof typeof want;
    if (want[k] > 0) {
      want[k]--;
      mine.add(byTime[i].h.id);
    }
  }
  for (const o of byTime) if (mine.has(o.h.id)) o.h.sector = "you";

  // Other sectors: their operators approve aid and dispatch their own fleet.
  const fleet: OtherVehicle[] = OTHER_FLEET.map((v) => ({ ...v, freeAt: 0 }));
  for (const o of byTime) {
    if (o.h.sector === "you") continue;
    const id = o.h.id;
    const l: Lang = o.h.language === "es" ? "es" : "en";
    const operator = OTHER_OPERATORS[Number(id.slice(1)) % OTHER_OPERATORS.length];
    const decidedAt = o.at + (3 + random() * 6) * MIN;
    if (o.c.kind === "aid") {
      const size = (o.c.aid ?? "gas") as AidSize;
      const c = convo(id, decidedAt);
      c.e(T.aidApproved[l](usd(AID_TEXT[size].cents), AID_TEXT[size][l]), {
        case: { kind: "aid", status: "approved", aid: size, handledBy: operator },
        summary: `Aid approved by ${operator}: ${usd(AID_TEXT[size].cents)}`,
      });
      c.r(l === "es" ? "gracias, ya vamos saliendo" : "thank you, leaving now", { status: "leaving" });
      arrives(c, l, 30 + random() * 25);
      events.push(...c.ev);
      continue;
    }
    // Ride or door knock: the soonest-arriving capable vehicle in another sector.
    const wheelchair = Boolean(o.c.wheelchair);
    let best: { v: OtherVehicle; start: number; eta: number } | null = null;
    for (const v of fleet) {
      if (wheelchair && !v.wheelchair) continue;
      const start = Math.max(decidedAt, v.freeAt);
      const eta = drive(v.pos, o.h.location);
      if (!best || start + eta * MIN < best.start + best.eta * MIN) best = { v, start, eta };
    }
    if (!best) continue;
    const toShelter = drive(o.h.location, SHELTER.location);
    const c = convo(id, best.start);
    const caseBase = { kind: o.c.kind, vehicleName: best.v.name, etaMin: best.eta, handledBy: operator } as Partial<SimCase>;
    if (o.c.kind === "check") {
      c.e(l === "es" ? `⚠️ ${best.v.name} va a revisar su casa ahora.` : `⚠️ ${best.v.name} is coming to check your home now.`, {
        case: { ...caseBase, status: "dispatched" },
        summary: `${best.v.name} sent to knock (${operator})`,
      });
      c.wait(best.eta);
      events.push({
        at: c.now(),
        householdId: id,
        kind: "status",
        status: "leaving",
        summary: `${best.v.name} knocked: ${1 + Math.floor(random() * 2)} found inside, helping them out`,
        case: { ...caseBase, status: "onboard" },
      });
    } else {
      c.e(T.dispatched[l](best.v.name, best.eta), { case: { ...caseBase, status: "dispatched" }, summary: `${best.v.name} dispatched by ${operator} · ${best.eta} min` });
      c.wait(best.eta);
      c.e(T.outside[l](best.v.name));
      c.wait(2);
      c.e(T.onboard[l], { status: "leaving", case: { ...caseBase, status: "onboard" }, summary: `On board ${best.v.name} → shelter` });
    }
    c.wait(toShelter);
    c.e(T.checkedIn[l], { status: "out", case: { ...caseBase, status: "done" }, summary: "Checked in at the shelter" });
    events.push(...c.ev);
    best.v.freeAt = c.now() + toShelter * MIN;
    best.v.pos = SHELTER.location;
  }

  events.sort((a, b) => a.at - b.at);
  return { households, events };
}

export const { households: SIM_HOUSEHOLDS, events: SIM_EVENTS } = buildHouseholds();

export type HouseholdView = SimHousehold & {
  alerted: boolean;
  summary?: string;
  case?: SimCase;
};

const ALERT_SIM = ALERT.en;

function apply(h: HouseholdView, e: Pick<ReplayEvent, "status" | "needs" | "summary" | "leftBehind" | "doorKnock" | "language" | "case">) {
  if (e.status) h.status = e.status;
  if (e.needs) Object.assign(h.needs, e.needs);
  if (e.summary) h.summary = e.summary;
  if (e.leftBehind) h.leftBehind = e.leftBehind;
  if (e.doorKnock) h.doorKnock = true;
  if (e.language) h.language = e.language;
  if (e.case) h.case = { ...(h.case ?? { kind: "ride", status: "review" }), ...e.case } as SimCase;
}

/** Every household's state at time t, from the scripted events. */
export function householdsAt(t: number): HouseholdView[] {
  const byId = new Map<string, HouseholdView>(
    SIM_HOUSEHOLDS.map((h) => [h.id, { ...h, needs: { ...h.needs }, messages: [], alerted: false, language: "en" }]),
  );
  for (const e of SIM_EVENTS) {
    if (e.at > t) break;
    const h = byId.get(e.householdId);
    if (!h) continue;
    h.lastUpdate = e.at;
    if (e.kind === "alert") {
      h.alerted = true;
      h.messages.push({ at: e.at, from: "evacuaid", text: ALERT_SIM });
      continue;
    }
    if (e.kind === "msg" && e.text) h.messages.push({ at: e.at, from: e.from ?? "evacuaid", text: e.text });
    apply(h, e);
  }
  return [...byId.values()];
}

/** What the operator did to a simulated household, played onto the replay. */
export type OperatorOverlay = {
  dispatches: { householdId: string; vehicleName: string; etaMin: number; toShelterMin: number; at: number; live: boolean }[];
  approvals: { householdId: string; decision: "approved" | "held" | "declined"; kind: AidSize; cents: number; replayAt?: number }[];
  messages: { householdId: string; at: number; text: string }[];
};

export function applyOperator(views: HouseholdView[], ops: OperatorOverlay, t: number): HouseholdView[] {
  const byId = new Map(views.map((h) => [h.id, h]));
  const add = (h: HouseholdView, at: number, from: "resident" | "evacuaid", text: string) => {
    if (at <= t) h.messages.push({ at, from, text });
  };
  for (const m of ops.messages) {
    const h = byId.get(m.householdId);
    if (h) add(h, m.at, "evacuaid", m.text);
  }
  for (const a of ops.approvals) {
    const h = byId.get(a.householdId);
    if (!h || a.replayAt === undefined || a.replayAt > t) continue;
    const l: Lang = h.language === "es" ? "es" : "en";
    if (a.decision === "approved") {
      add(h, a.replayAt, "evacuaid", T.aidApproved[l](usd(a.cents), AID_TEXT[a.kind][l]));
      apply(h, { case: { kind: "aid", status: "approved", aid: a.kind, handledBy: "You" }, summary: `You approved ${usd(a.cents)}` });
      if (t >= a.replayAt + 4 * MIN) {
        add(h, a.replayAt + 4 * MIN, "resident", l === "es" ? "gracias, ya vamos saliendo" : "got it, thank you. leaving now");
        apply(h, { status: "leaving" });
      }
      if (t >= a.replayAt + 40 * MIN) apply(h, { status: "out", summary: "Arrived safely" });
    } else {
      add(h, a.replayAt, "evacuaid", a.decision === "held" ? T.aidHeld[l] : T.aidDeclined[l]);
      apply(h, { case: { kind: "aid", status: a.decision, aid: a.kind, handledBy: "You" } });
    }
  }
  for (const d of ops.dispatches) {
    const h = byId.get(d.householdId);
    if (!h || d.live || d.at > t) continue;
    const l: Lang = h.language === "es" ? "es" : "en";
    const base = { kind: (h.case?.kind === "check" ? "check" : "ride") as SimCase["kind"], vehicleName: d.vehicleName, etaMin: d.etaMin, handledBy: "You" };
    add(h, d.at, "evacuaid", T.dispatched[l](d.vehicleName, d.etaMin));
    apply(h, { case: { ...base, status: "dispatched" }, summary: `You dispatched ${d.vehicleName} · ${d.etaMin} min` });
    const there = d.at + d.etaMin * MIN;
    if (t >= there) add(h, there, "evacuaid", T.outside[l](d.vehicleName));
    if (t >= there + 2 * MIN) {
      add(h, there + 2 * MIN, "evacuaid", T.onboard[l]);
      apply(h, { status: "leaving", case: { ...base, status: "onboard" }, summary: `On board ${d.vehicleName} → shelter` });
    }
    const done = there + (2 + d.toShelterMin) * MIN;
    if (t >= done) {
      add(h, done, "evacuaid", T.checkedIn[l]);
      apply(h, { status: "out", case: { ...base, status: "done" }, summary: "Checked in at the shelter" });
    }
  }
  for (const h of views) h.messages.sort((a, b) => a.at - b.at);
  return views;
}

export type Counts = Record<Status, number> & { alerted: number; total: number };

export function countStatuses(hs: HouseholdView[]): Counts {
  const c: Counts = { needs_help: 0, no_response: 0, leaving: 0, out: 0, alerted: 0, total: hs.length };
  for (const h of hs) {
    if (!h.alerted) continue;
    c.alerted++;
    c[h.status]++;
  }
  return c;
}

/** The first alert EvacuAid would have sent to anyone in west Altadena. */
export const FIRST_ALERT = Math.min(...SIM_HOUSEHOLDS.map((h) => h.alertAt));
