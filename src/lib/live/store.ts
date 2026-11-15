// Live households: real phone numbers on the roster and anyone who texts in.
// In-memory for the demo (one server); Tiger Data persistence comes later.

import { aidDecisionText, ALERT, newConv, startAid, step, T, type AidSize, type Case, type Conv, type Step } from "../agent/conversation";
import { converseWithGemini } from "../gemini";
import { randomBytes, randomUUID } from "node:crypto";
import { currentRun } from "../activity";
import { tigerEvent, type TigerKind } from "../tiger";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SIM_HOUSEHOLDS } from "../replay/households";
import { FLEET, SHELTER } from "../replay/fleet";
import { normalizePhone } from "./phone";
import type { Household, LngLat, Needs } from "../types";
import { assignedHandles, hasPhotonRoute, photonConfigured, photonSend, startPhoton } from "./photon";

export type SendResult = { ok: boolean; via: "imessage" | "simulated"; error?: string };

export const ALERT_TEXT = ALERT.en;

export type LiveMessage = Household["messages"][number] & {
  via?: SendResult["via"];
  error?: string;
  summary?: string;
  /** Written by the operator from the console (not EvacuAid's automatic replies). */
  byOperator?: boolean;
};

export type LiveHousehold = Omit<Household, "messages"> & {
  name: string;
  alerted: boolean;
  live: true;
  summary?: string;
  engine?: "gemini" | "rules" | "flow";
  conv: Conv;
  driver?: string;
  /** Minutes to the shelter for the current trip (to resume after a restart). */
  tripShelterMin?: number;
  /** The resident's private "track your ride" link for the current trip. Cleared on reset. */
  track?: Track;
  /** Operator switch: does "Send alert" text this phone? */
  alertsOn: boolean;
  /** How they joined: operator added, web sign-up, or texted the number. */
  source?: "operator" | "signup" | "text";
  messages: LiveMessage[];
  notified: string[]; // vehicle ids we've already texted about
};

/** One trip, as the resident's tracking page sees it. Times are real clock times. */
export type Track = {
  token: string;
  vehicleId: string;
  vehicleName: string;
  /** Minutes the texts quoted (the page counts down from these). */
  etaMin: number;
  toShelterMin: number;
  from: LngLat;
  dispatchedAt: number;
  arriveAt: number;
  boardAt: number;
  shelterAt: number;
  /** When the "outside" text went out: from then on, IN boards them. */
  outsideAt?: number;
};

// Real-looking spots in west Altadena for live households (no real addresses used).
const SPOTS: { lng: number; lat: number; address: string }[] = [
  { lng: -118.1534, lat: 34.1902, address: "Live · Woodbury Rd" },
  { lng: -118.1468, lat: 34.1958, address: "Live · Mariposa St" },
  { lng: -118.1601, lat: 34.1884, address: "Live · Lincoln Ave" },
  { lng: -118.1419, lat: 34.1873, address: "Live · Altadena Dr" },
  { lng: -118.1566, lat: 34.1987, address: "Live · Loma Alta Dr" },
  { lng: -118.1497, lat: 34.1822, address: "Live · Ventura St" },
];

const NO_NEEDS: Needs = {
  mobility: false,
  medical: false,
  children: false,
  pets: false,
  noTransport: false,
  money: false,
  people: 1,
};

type Store = { households: Map<string, LiveHousehold>; alertSentAt: number | null; version: number; resetAt?: number };
const g = globalThis as unknown as { __evacuaidLive?: Store };

// Real phones are never lost: the roster and every conversation are saved to disk
// and reloaded when the server starts. Only STOP turns a phone off; nothing deletes it.
const LIVE_FILE = "data/live-store.json";
function loadStore(): Store {
  try {
    if (existsSync(LIVE_FILE)) {
      const j = JSON.parse(readFileSync(LIVE_FILE, "utf8")) as { households: LiveHousehold[]; alertSentAt: number | null; version: number; resetAt?: number };
      return { households: new Map(j.households.map((h) => [h.phone, h])), alertSentAt: j.alertSentAt, version: j.version ?? 0, resetAt: j.resetAt };
    }
  } catch {
    // unreadable: start clean
  }
  return { households: new Map(), alertSentAt: null, version: 0 };
}
const store: Store = (g.__evacuaidLive ??= loadStore());
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync("data", { recursive: true });
      writeFileSync(
        LIVE_FILE,
        JSON.stringify({ households: [...store.households.values()], alertSentAt: store.alertSentAt, version: store.version, resetAt: store.resetAt }),
      );
    } catch {
      // read-only disk: keep it in memory
    }
  }, 250);
}

export { normalizePhone };

function bump() {
  store.version++;
  persist();
}

export function snapshot() {
  return {
    version: store.version,
    alertSentAt: store.alertSentAt,
    resetAt: store.resetAt ?? null,
    households: [...store.households.values()],
  };
}

type Spot = { lng: number; lat: number; address: string };

/** A random real street address from the replay, so a new sign-up lands somewhere in the zone. */
export function randomHouse(): Spot {
  const h = SIM_HOUSEHOLDS[Math.floor(Math.random() * SIM_HOUSEHOLDS.length)];
  return { lng: h.location.lng, lat: h.location.lat, address: h.address };
}

export function addToRoster(name: string, rawPhone: string, at?: Spot): LiveHousehold {
  const phone = normalizePhone(rawPhone);
  const existing = store.households.get(phone);
  if (existing) {
    existing.name = name || existing.name;
    bump();
    return existing;
  }
  const spot = at ?? SPOTS[store.households.size % SPOTS.length];
  const h: LiveHousehold = {
    // Not derived from the phone number: ids are visible to the public.
    id: `live-${randomUUID().slice(0, 8)}`,
    name: name || "Resident",
    phone,
    address: spot.address,
    location: { lng: spot.lng, lat: spot.lat },
    language: "en",
    profile: { age75plus: false, hasCar: true, lowIncome: false },
    status: "no_response",
    needs: { ...NO_NEEDS },
    messages: [],
    lastUpdate: Date.now(),
    alerted: false,
    live: true,
    conv: newConv(),
    alertsOn: true,
    notified: [],
  };
  store.households.set(phone, h);
  bump();
  return h;
}

export function setAlertsOn(rawPhone: string, on: boolean) {
  const h = store.households.get(normalizePhone(rawPhone));
  if (!h) return null;
  h.alertsOn = on;
  bump();
  return h;
}

export function removeFromRoster(rawPhone: string) {
  store.households.delete(normalizePhone(rawPhone));
  bump();
}

/** iMessage through Photon if the resident has texted our number; otherwise simulated (web phone). */
async function deliver(phone: string, text: string): Promise<SendResult> {
  if (photonConfigured() && hasPhotonRoute(phone)) {
    const r = await photonSend(phone, text);
    return { ok: r.ok, via: "imessage", error: r.error };
  }
  return { ok: true, via: "simulated" };
}

async function send(h: LiveHousehold, text: string, opts: { force?: boolean; byOperator?: boolean } = {}) {
  // A resident who replied STOP gets nothing more until they text us again.
  if (h.alertsOn === false && !opts.force) return { ok: false, via: "simulated" as const, error: "messages are off (STOP)" };
  const r = await deliver(h.phone, text);
  h.messages.push({ at: Date.now(), from: "evacuaid", text, via: r.via, error: r.error, byOperator: opts.byOperator });
  tigerEvent({ kind: "text_out", run: currentRun(), system: "evacuaid", household: h.id, detail: opts.byOperator ? "operator" : r.via });
  h.lastUpdate = Date.now();
  bump();
  return r;
}

/** The operator's one click: alert everyone on the roster. */
export async function sendAlert() {
  store.alertSentAt = Date.now();
  // The alert is the order: publish it on Solana so the donor pool unlocks (no-op if already there).
  import("../solana/pool")
    .then((m) => m.ensureOrder())
    .catch((e) => console.warn("[solana order]", (e as Error).message));
  const results = await Promise.all(
    [...store.households.values()].filter((h) => h.alertsOn !== false).map(async (h) => {
      h.alerted = true;
      const r = await send(h, ALERT_TEXT);
      return { phone: h.phone, ...r };
    }),
  );
  bump();
  return results;
}

const SPANISH = /\b(hola|ayuda|necesito|no puedo|tenemos|somos|mi |mamá|mama|abuela|carro|casa|gracias|sí|estoy|salir|fuego)\b/i;

const SIGNUP = /^(evac|evacuaid|join|start|sign ?up|subscribe|hi|hello|hey|help)[.!]*$/i;
const STOP = /^(stop|unsubscribe|cancel|quit|end)[.!]*$/i;
/** "I'm seated" once the van is outside. */
const IN_WORD = /^(in|i'?m in|im in|seated|on board|onboard|dentro|adentro|listo|lista)[.!]*$/i;
const SIGNUP_REPLY =
  "You're signed up for EvacuAid. If an evacuation order covers your area, we'll message you here and ask if you're safe. You can also tell us now if anyone at home would need help leaving. Reply STOP to leave.";

/** A resident's reply, from iMessage or the web phone. Returns the text we send back. */
export async function handleInbound(rawPhone: string, text: string, opts: { replyBySms: boolean }) {
  const phone = normalizePhone(rawPhone);
  const existing = store.households.get(phone);

  if (STOP.test(text.trim())) {
    if (!existing) return { reply: "", triage: null, household: existing };
    existing.messages.push({ at: Date.now(), from: "resident", text });
    existing.conv ??= newConv();
    const l = existing.language === "es" ? "es" : "en";
    const stillNeeds = existing.status === "needs_help" && !existing.conv.stopAsked;
    let reply: string;
    if (stillNeeds) {
      // Double-check before going quiet on someone we think is still in danger.
      existing.conv.stopAsked = true;
      reply = T.stopConfirm[l];
    } else {
      existing.alertsOn = false;
      existing.summary = "Asked to stop messages";
      reply = T.stopped[l];
    }
    if (opts.replyBySms) await send(existing, reply, { force: true });
    else existing.messages.push({ at: Date.now(), from: "evacuaid", text: reply, via: "simulated" });
    bump();
    return { reply, triage: null, household: existing };
  }

  // IN: they're seated, so the van leaves now instead of waiting.
  const trip = existing?.conv?.case;
  if (existing && IN_WORD.test(text.trim()) && trip?.vehicleId && (trip.status === "dispatched" || trip.status === "onboard")) {
    existing.messages.push({ at: Date.now(), from: "resident", text });
    const l = existing.language === "es" ? "es" : "en";
    let reply: string | null;
    if (trip.status === "onboard") reply = null; // already on the way: say nothing twice
    else if (!existing.track?.outsideAt) reply = T.notOutsideYet[l];
    else reply = boardNow(existing);
    if (reply) {
      if (opts.replyBySms) await send(existing, reply);
      else existing.messages.push({ at: Date.now(), from: "evacuaid", text: reply, via: "simulated" });
    }
    existing.lastUpdate = Date.now();
    bump();
    return { reply: reply ?? "", triage: null, household: existing };
  }

  // Texting the number is how people sign up. "help" only counts as a sign-up
  // when no order is active; during one, it goes straight to triage.
  const signupWord = SIGNUP.test(text.trim()) && !(store.alertSentAt && /^help/i.test(text.trim()));
  if ((!existing || !existing.alerted) && signupWord) {
    const h = existing ?? addToRoster("", phone, randomHouse());
    h.source ??= "text";
    h.messages.push({ at: Date.now(), from: "resident", text });
    h.summary = "Signed up";
    if (opts.replyBySms) await send(h, SIGNUP_REPLY);
    else h.messages.push({ at: Date.now(), from: "evacuaid", text: SIGNUP_REPLY, via: "simulated" });
    h.lastUpdate = Date.now();
    // Signed up while an order is already out: they get the alert right away.
    if (store.alertSentAt && !h.alerted) {
      h.alerted = true;
      if (opts.replyBySms) await send(h, ALERT_TEXT);
      else h.messages.push({ at: Date.now(), from: "evacuaid", text: ALERT_TEXT, via: "simulated" });
    }
    bump();
    return { reply: SIGNUP_REPLY, triage: null, household: h };
  }

  const h = existing ?? addToRoster("", phone);
  h.conv ??= newConv();
  h.conv.stopAsked = false;
  h.alertsOn = true;
  h.alerted = true;
  tigerEvent({ kind: "text_in", run: currentRun(), system: "evacuaid", household: h.id });
  h.messages.push({ at: Date.now(), from: "resident", text });
  h.lastUpdate = Date.now();
  // They answered, so nobody needs to knock on the door just to find out.
  h.conv.doorKnock = false;
  if (SPANISH.test(text)) h.language = "es";
  bump();

  let reply: string;
  let summary: string;
  const flow = step(h.conv, text, h.language, h.needs);

  if (flow) {
    h.engine = "flow";
    applyStep(h, flow);
    reply = flow.reply;
    summary = flow.summary;
  } else {
    const a = await converseWithGemini(text, {
      stage: h.conv.stage,
      status: h.status,
      needs: h.needs,
      language: h.language,
      driverAssigned: h.driver ?? null,
      stipend: h.conv.case?.kind === "aid" ? h.conv.case.status : null,
      history: h.messages.slice(0, -1).map((m) => ({ from: m.from, text: m.text })),
    });
    h.engine = a.engine;
    h.status = a.status;
    Object.assign(h.needs, a.needs);
    h.language = a.language;
    if (a.leftBehind) {
      h.conv.leftBehind = a.leftBehind;
      h.status = "needs_help";
    }
    if (a.emergency) h.conv.emergency = true;
    reply = a.reply;
    summary = a.summary;
    h.conv.stage = a.stage;

    const openCase = h.conv.case && !["done", "declined"].includes(h.conv.case.status);
    if ((a.offerStipend || (a.needs.money && !a.needs.noTransport && !a.needs.mobility)) && !openCase) {
      // Cost is the barrier: size it with questions instead of promising money.
      const s2 = startAid(h.language, a.status === "leaving" ? "leaving" : "help");
      applyStep(h, s2);
      reply = s2.reply;
      summary = s2.summary;
    } else if (h.status === "needs_help" && (h.needs.mobility || h.needs.noTransport || h.needs.medical || a.emergency) && !openCase) {
      // They need a vehicle: open a ride case for the operator and say so.
      const people = Math.max(1, h.needs.people || 1);
      const l = h.language === "es" ? "es" : "en";
      openOrUpdateCase(h, { kind: "ride", status: "review", people, wheelchair: h.needs.mobility, medical: h.needs.medical });
      h.conv.stage = "ride_review";
      reply = `${a.emergency ? (l === "es" ? "🚨 LLAME AL 911 AHORA si está en peligro inmediato.\n\n" : "🚨 CALL 911 NOW if you're in immediate danger.\n\n") : ""}${T.rideReview[l](people, h.needs.mobility)}`;
    }
  }

  h.summary = h.conv.leftBehind && !summary.toLowerCase().includes("left") ? `${summary} · left behind: ${h.conv.leftBehind}` : summary;
  h.messages[h.messages.length - 1].summary = summary;

  if (opts.replyBySms) {
    await send(h, reply);
  } else {
    h.messages.push({ at: Date.now(), from: "evacuaid", text: reply, via: "simulated" });
    bump();
  }
  return { reply, triage: { status: h.status, needs: h.needs, summary, engine: h.engine, stage: h.conv.stage }, household: h };
}

const NUDGE_AFTER_MS = Number(process.env.NUDGE_AFTER_SEC || 90) * 1000;

/**
 * Silent homes are the ones that die. Re-text anyone alerted who hasn't
 * answered; after the second try, flag the home for a door knock.
 */
export async function nudgeSilent(now = Date.now()) {
  const done: { id: string; nudge: number }[] = [];
  for (const h of store.households.values()) {
    h.conv ??= newConv();
    if (!h.alerted || h.status !== "no_response" || h.conv.doorKnock) continue;
    const lastOut = [...h.messages].reverse().find((m) => m.from === "evacuaid");
    if (!lastOut || now - lastOut.at < NUDGE_AFTER_MS) continue;
    const l = h.language === "es" ? "es" : "en";
    if (h.conv.nudges === 0) {
      h.conv.nudges = 1;
      await send(h, T.nudge1[l]);
    } else {
      h.conv.nudges = 2;
      h.conv.doorKnock = true;
      openOrUpdateCase(h, { kind: "check", status: "review" });
      h.summary = "No reply after 2 texts · door knock";
      await send(h, T.nudge2[l]);
    }
    done.push({ id: h.id, nudge: h.conv.nudges });
  }
  if (done.length) bump();
  return done;
}

/** Open the operator's case, or update the open one. */
function openOrUpdateCase(h: LiveHousehold, patch: Partial<Case> & { kind?: Case["kind"] }) {
  const cur = h.conv.case;
  if (patch.status === "review" && cur?.status !== "review") {
    tigerEvent({ kind: `case_${patch.kind ?? cur?.kind ?? "ride"}` as TigerKind, run: currentRun(), system: "evacuaid", household: h.id });
  }
  if (!cur || patch.kind && patch.kind !== cur.kind) {
    h.conv.case = { kind: patch.kind ?? "ride", status: "gathering", openedAt: Date.now(), ...patch } as Case;
  } else {
    Object.assign(cur, patch);
  }
}

function applyStep(h: LiveHousehold, flow: Step) {
  if (flow.status) h.status = flow.status;
  if (flow.needs) Object.assign(h.needs, flow.needs);
  if (flow.leftBehind) h.conv.leftBehind = flow.leftBehind;
  if (flow.offerFrom) h.conv.offerFrom = flow.offerFrom;
  if (flow.stage === "out_done") h.conv.leftBehind = undefined;
  if (flow.case) openOrUpdateCase(h, flow.case);
  // Safe now: any open case is finished.
  if (flow.status === "out" && h.conv.case && !["done", "declined"].includes(h.conv.case.status)) h.conv.case.status = "done";
  h.conv.stage = flow.stage;
}

export function findLive(householdId: string) {
  return [...store.households.values()].find((x) => x.id === householdId) ?? null;
}

// ---- operator actions (the console) --------------------------------------

/** Demo time: a 6-minute drive plays out in 60 seconds so the whole rescue fits on stage. */
const DEMO_SECONDS_PER_MIN = Number(process.env.DEMO_SECONDS_PER_MIN || 10);

/** The operator dispatches a vehicle: the resident hears every step until they're checked in. */
export async function dispatchLive(householdId: string, vehicle: { id: string; name: string }, etaMin: number, toShelterMin: number) {
  const h = findLive(householdId);
  if (!h) throw new Error("Not a live household");
  const l = h.language === "es" ? "es" : "en";
  openOrUpdateCase(h, { kind: h.conv.case?.kind === "check" ? "check" : "ride", status: "dispatched", vehicleId: vehicle.id, vehicleName: vehicle.name, etaMin });
  h.conv.stage = "ride_dispatched";
  h.driver = `${vehicle.name}, about ${etaMin} min`;
  h.summary = `${vehicle.name} dispatched · ${etaMin} min`;
  h.tripShelterMin = toShelterMin;
  const now = Date.now();
  // A fresh, unguessable code for every trip: an earlier link stops working.
  h.track = {
    token: randomBytes(9).toString("base64url"),
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    etaMin,
    toShelterMin,
    from: FLEET.find((v) => v.id === vehicle.id)?.location ?? SHELTER.location,
    dispatchedAt: now,
    arriveAt: now,
    boardAt: now,
    shelterAt: now,
  };
  runTrip(h, vehicle, "arriving", etaMin, toShelterMin);
  await send(h, T.dispatched[l](vehicle.name, etaMin));
  await send(h, trackText(l, h.track.token));
  bump();
}

/** Where residents open their tracking page. The live site reaches the same app. */
const PUBLIC_URL = (process.env.PUBLIC_BASE_URL || "https://evacuid.us").replace(/\/$/, "");
export const trackUrl = (token: string) => `${PUBLIC_URL}/t/${token}`;
function trackText(l: "en" | "es", token: string) {
  return T.track[l](trackUrl(token));
}

/** The trip behind a tracking code, or null once it ended or the drill was reset. */
export function findTrack(token: string) {
  if (!token || token.length < 10) return null;
  for (const h of store.households.values()) {
    if (h.track?.token === token) return { h, t: h.track };
  }
  return null;
}

const tripMs = (m: number) => Math.max(5, m) * DEMO_SECONDS_PER_MIN * 1000;

/**
 * The rest of a live trip: van outside, on board, checked in. Each step is
 * re-checked against the saved case, so a restart can pick the trip back up.
 * The resident can reply IN once seated to leave right away; otherwise the
 * van leaves on its own after a short wait.
 */
function runTrip(h: LiveHousehold, vehicle: { id: string; name: string }, from: "arriving" | "onboard", etaMin: number, toShelterMin: number) {
  const l = h.language === "es" ? "es" : "en";
  const still = () => h.conv.case?.vehicleId === vehicle.id;
  // Record the schedule so the tracking page can move the van in step with the texts.
  if (h.track && h.track.vehicleId === vehicle.id) {
    const now = Date.now();
    if (from === "arriving") {
      h.track.arriveAt = now + tripMs(etaMin);
      h.track.boardAt = h.track.arriveAt + tripMs(2);
    } else {
      h.track.arriveAt = Math.min(h.track.arriveAt, now);
      h.track.boardAt = now;
    }
    h.track.shelterAt = h.track.boardAt + tripMs(toShelterMin);
  }
  if (from === "onboard") return scheduleCheckIn(h, vehicle.id, toShelterMin);
  setTimeout(async () => {
    if (!still() || h.conv.case?.status !== "dispatched") return;
    if (h.track && h.track.vehicleId === vehicle.id) h.track.outsideAt = Date.now();
    await send(h, T.outside[l](vehicle.name));
    bump();
    // No reply? The van leaves after a short wait anyway.
    setTimeout(async () => {
      if (!still()) return;
      const text = boardNow(h);
      if (text) await send(h, text);
    }, tripMs(2));
  }, tripMs(etaMin));
}

/**
 * The resident is on board. Runs once per trip, whether from their IN reply or
 * the van's own timer: a second call does nothing, so nobody gets two texts.
 * Returns the text to send, or null if they were already on board.
 */
function boardNow(h: LiveHousehold): string | null {
  const c = h.conv.case;
  if (!c?.vehicleId || c.status !== "dispatched") return null;
  const l = h.language === "es" ? "es" : "en";
  const toShelterMin = h.tripShelterMin ?? 8;
  h.status = "leaving";
  c.status = "onboard";
  h.summary = `On board ${c.vehicleName ?? "the van"} → shelter`;
  if (h.track && h.track.vehicleId === c.vehicleId) {
    const now = Date.now();
    h.track.arriveAt = Math.min(h.track.arriveAt, now);
    h.track.boardAt = now;
    h.track.shelterAt = now + tripMs(toShelterMin);
  }
  scheduleCheckIn(h, c.vehicleId, toShelterMin);
  bump();
  return T.onboard[l];
}

function scheduleCheckIn(h: LiveHousehold, vehicleId: string, toShelterMin: number) {
  const l = h.language === "es" ? "es" : "en";
  setTimeout(async () => {
    const c = h.conv.case;
    if (c?.vehicleId !== vehicleId || c.status !== "onboard") return; // once only
    h.status = "out";
    c.status = "done";
    h.conv.stage = "out_done";
    h.summary = "Checked in at the shelter";
    h.driver = undefined;
    await send(h, T.checkedIn[l]);
    bump();
  }, tripMs(toShelterMin));
}

// A restart mid-trip must not strand anyone: resume every trip still under way.
for (const h of store.households.values()) {
  const c = h.conv.case;
  if (!c?.vehicleId || (c.status !== "dispatched" && c.status !== "onboard")) continue;
  const v = { id: c.vehicleId, name: c.vehicleName ?? "Your ride" };
  runTrip(h, v, c.status === "onboard" ? "onboard" : "arriving", 2, h.tripShelterMin ?? 8);
}

/** After the operator approves aid and the bank decides: tell the resident exactly what happened. */
export async function aidDecidedLive(householdId: string, decision: "approved" | "held" | "declined", size: AidSize, cents: number) {
  const h = findLive(householdId);
  if (!h) return;
  openOrUpdateCase(h, { kind: "aid", status: decision, aid: size });
  if (decision === "approved") {
    h.summary = `Aid approved: $${cents / 100} ${size === "gas" ? "gas" : size === "night" ? "gas + a night" : "full"}`;
    h.conv.stage = h.status === "leaving" ? "leaving_done" : "help_confirmed";
  }
  await send(h, aidDecisionText(h.language, decision, size, cents));
  bump();
}

/** The operator writes to a resident directly from the console. */
export async function operatorMessage(householdId: string, text: string) {
  const h = findLive(householdId);
  if (!h) throw new Error("Not a live household");
  const r = await send(h, text, { byOperator: true });
  return r;
}

// Residents who text the EvacuAid iMessage number land here.
startPhoton(async (phone, text) => {
  await handleInbound(phone, text, { replyBySms: true });
});

// A roster is never lost: if it's empty (first start), rebuild it from every
// phone Photon has on our iMessage lines. They come back with alerts on.
if (store.households.size === 0) {
  assignedHandles()
    .then((list) => {
      for (const a of list) {
        if (store.households.has(a.handle)) continue;
        const h = addToRoster(a.name ?? "", a.handle, randomHouse());
        h.source = "text";
      }
    })
    .catch(() => undefined);
}

/** New drill: everyone stays signed up, but tonight's statuses and messages are wiped. */
export function resetLive() {
  for (const h of store.households.values()) {
    h.status = "no_response";
    h.needs = { ...NO_NEEDS };
    h.messages = [];
    h.conv = newConv();
    h.alerted = false;
    h.notified = [];
    h.summary = undefined;
    h.driver = undefined;
    h.track = undefined; // every tracking link from the last drill stops working
    h.tripShelterMin = undefined;
    h.alertsOn = true;
    h.lastUpdate = Date.now();
  }
  store.alertSentAt = null;
  store.resetAt = Date.now();
  bump();
}
