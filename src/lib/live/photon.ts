// iMessage through Photon 2.0. Residents text the EvacuAid number first (sign-up);
// after that, alerts and follow-ups go into the same conversation. Replies are
// polled from Photon, so nothing here needs a public URL.

import { Photon } from "@photon-ai/api";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Route = { spaceId: string; senderId: string; lastInboundId: string };
type State = {
  routes: Map<string, Route>; // resident phone -> conversation
  seen: Set<string>;
  since: number;
  polling: boolean;
  lastError?: string;
  onInbound?: (phone: string, text: string) => Promise<void>;
};

const g = globalThis as unknown as { __evacuaidPhoton?: State };
// Which Photon conversation each phone is in. Saved to disk so a restart (or moving
// to another machine with the same data folder) can still text every phone first.
const ROUTES_FILE = "data/photon-routes.json";
function loadRoutes(): Map<string, Route> {
  try {
    if (existsSync(ROUTES_FILE)) return new Map(Object.entries(JSON.parse(readFileSync(ROUTES_FILE, "utf8")) as Record<string, Route>));
  } catch {
    // unreadable: phones re-link the next time they text
  }
  return new Map();
}
function saveRoutes() {
  try {
    mkdirSync("data", { recursive: true });
    writeFileSync(ROUTES_FILE, JSON.stringify(Object.fromEntries(state.routes)));
  } catch {
    // read-only disk: keep them in memory
  }
}
const state: State = (g.__evacuaidPhoton ??= { routes: loadRoutes(), seen: new Set(), since: Date.now(), polling: false });

const project = () => process.env.PHOTON_PROJECT_ID;
const agentHandle = () => process.env.PHOTON_AGENT_HANDLE;
// PHOTON_DISABLED=1 keeps a second copy (your laptop) from answering texts the live server already answers.
export const photonConfigured = () => process.env.PHOTON_DISABLED !== "1" && Boolean(process.env.PHOTON_API_KEY && project() && agentHandle());

let client: Photon | null = null;
function api() {
  client ??= new Photon({ headers: { Authorization: `Bearer ${process.env.PHOTON_API_KEY}` } });
  return client;
}

export function photonStatus() {
  return {
    on: photonConfigured(),
    number: agentHandle() ?? null,
    polling: state.polling,
    connected: state.routes.size,
    error: state.lastError ?? null,
  };
}

export const hasPhotonRoute = (phone: string) => state.routes.has(phone);

/**
 * Put a new resident's phone on one of the project's shared iMessage lines.
 * Photon picks the line, so the number they text can differ per person.
 */
/** Every phone currently on our iMessage lines (used to rebuild a lost roster). */
export async function assignedHandles(): Promise<{ handle: string; name?: string }[]> {
  if (!photonConfigured()) return [];
  try {
    const r = await api().projects.platforms.imessage.assignments.list({ path: { id: project()! } });
    return r.assignments.filter((a) => !a.releasedAt && /^\+\d{10,15}$/.test(a.handle)).map((a) => ({ handle: a.handle, name: a.firstName }));
  } catch {
    return [];
  }
}

export async function assignLine(phone: string, firstName?: string): Promise<{ number: string | null; error?: string }> {
  if (!photonConfigured()) return { number: null, error: "iMessage isn't connected" };
  const lines = api().projects.platforms.imessage.assignments;
  try {
    const existing = await lines.list({ path: { id: project()! } });
    const mine = existing.assignments.find((a) => a.handle === phone && !a.releasedAt);
    if (mine) return { number: mine.assignedPhoneNumber };
    const a = await lines.create({
      path: { id: project()! },
      headers: { idempotencyKey: `evacuaid-signup:${phone}` },
      body: { handle: phone, ...(firstName ? { firstName } : {}) },
    });
    return { number: a.assignedPhoneNumber };
  } catch (e) {
    return { number: null, error: problem(e) };
  }
}

function problem(e: unknown) {
  const err = e as { status?: number; body?: { code?: string; detail?: string }; message?: string };
  return err.body?.code ? `${err.body.code}${err.body.detail ? `: ${err.body.detail}` : ""}` : (err.message ?? "Photon error");
}

let counter = 0;
export async function photonSend(phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const r = state.routes.get(phone);
  if (!r) return { ok: false, error: "This phone hasn't texted the EvacuAid number yet" };
  try {
    await api().projects.sendMessage({
      path: { id: project()! },
      headers: { "idempotency-key": `evacuaid:${phone}:${Date.now()}:${++counter}` },
      body: { spaceId: r.spaceId, senderId: r.senderId, content: { type: "text", format: "plain", text } },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: problem(e) };
  }
}

type Msg = {
  id: string;
  createdAt: string;
  status: string;
  platform: string;
  sentBy?: { kind: string; handle: string; id: string };
  receivedBy?: { kind: string; handle: string; id: string };
  space: { id: string; kind?: string };
  content: { type: string; text?: string };
};

async function pollOnce() {
  const createdSince = new Date(state.since - 5_000).toISOString();
  let pageToken: string | undefined;
  do {
    const page = await api().projects.listMessages({
      path: { id: project()! },
      query: { createdSince, direction: "received", order: "asc", pageSize: 100, platform: "imessage", ...(pageToken ? { pageToken } : {}) },
    });
    for (const m of page.items as unknown as Msg[]) {
      if (state.seen.has(m.id)) continue;
      state.seen.add(m.id);
      if (Date.parse(m.createdAt) < state.since) continue; // before this server started
      if (m.sentBy?.kind !== "human" || m.receivedBy?.kind !== "agent") continue;
      if (m.content.type !== "text" || !m.content.text?.trim()) continue;
      const phone = m.sentBy.handle;
      const prev = state.routes.get(phone);
      state.routes.set(phone, { spaceId: m.space.id, senderId: m.receivedBy.id, lastInboundId: m.id });
      if (prev?.spaceId !== m.space.id || prev?.senderId !== m.receivedBy.id) saveRoutes();
      await state.onInbound?.(phone, m.content.text.trim()).catch((e) => console.warn("[photon inbound]", e));
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
}

/** Start polling once per server process. Safe to call on every request. */
export function startPhoton(onInbound: (phone: string, text: string) => Promise<void>) {
  state.onInbound = onInbound;
  if (!photonConfigured() || state.polling) return;
  state.polling = true;
  const loop = async () => {
    try {
      await pollOnce();
      state.lastError = undefined;
    } catch (e) {
      state.lastError = problem(e);
      console.warn("[photon poll]", state.lastError);
    }
    // 2 s, as Photon's guide does; back off when rate-limited.
    setTimeout(loop, state.lastError?.includes("429") ? 10_000 : 2_000);
  };
  loop();
}
