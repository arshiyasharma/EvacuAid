// End-to-end rehearsal against a running EvacuAid, the way a resident and an operator use it:
// a fictional resident texts in, asks for help, gets a van, is checked in, and gets aid.
//   bun --env-file=.env.local scripts/e2e-local.ts [http://localhost:3000]
// Uses a fictional 555 number (no real phone is texted) and removes it at the end.
// Signs as the operator with SESSION_SECRET, so run it only against your own app.
/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON from our own API */
import { SignJWT } from "jose";

const BASE = (process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const PHONE = "+14135550142";
const token = await new SignJWT({ role: "operator" })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(process.env.ADMIN_USERNAME ?? "operator")
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET ?? ""));
const H = { "Content-Type": "application/json", Origin: BASE, Cookie: `evacuaid_operator=${token}` };

let failed = 0;
const ok = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "  ok  " : " FAIL "} ${name}${detail ? `  ·  ${detail}` : ""}`);
};
const post = async (path: string, body: unknown, method = "POST") => {
  const r = await fetch(BASE + path, { method, headers: H, body: JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
};
const live = async () => (await (await fetch(BASE + "/api/live", { headers: H })).json()) as any;
const me = async () => (await live()).households.find((h: any) => h.phone === PHONE);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

console.log(`\nEvacuAid end-to-end · ${BASE}\n`);
ok("operator session accepted", (await live()).operator === true);

// 1. The resident texts in and asks for help (the web phone runs the same pipeline as iMessage).
for (const text of ["EVAC", "3", "my mom uses a wheelchair and we have no car"]) {
  const r = await post("/api/inbound", { phone: PHONE, text });
  ok(`resident: "${text}"`, r.status === 200 && typeof r.json.reply === "string", `${r.status} · "${String(r.json.reply ?? r.json.error ?? "").slice(0, 60).replace(/\n/g, " ")}"`);
}
let h = await me();
ok("case opened in the console", Boolean(h?.conv?.case), h?.conv?.case ? `${h.conv.case.kind} · ${h.conv.case.status} · "${h.summary ?? ""}"` : "no case");

// 2. Aid, while they wait: the operator approves gas money; Nessie checks it and pays the relief card.
const s = await post("/api/bank/stipend", { householdId: h?.id, kind: "gas", noTransport: true });
ok("aid requested through Nessie", s.status === 200 || s.status === 422, `${s.status} · ${JSON.stringify(s.json).slice(0, 110)}`);
const money = (await (await fetch(BASE + "/api/bank/money", { headers: H })).json()) as any;
const entry = money.stipends?.find((x: any) => x.householdId === h?.id);
ok("decision on the ledger", Boolean(entry), entry ? `${entry.decision} · $${entry.amountCents / 100} · tx ${entry.transactionId ? "yes" : "none"}` : "missing");

// 3. The operator dispatches a wheelchair-capable vehicle.
const d = await post("/api/cases/dispatch", { householdId: h?.id, vehicleId: "para-1" });
ok("operator dispatches Paratransit 1", d.status === 200, `${d.status}${d.json.error ? ` · ${d.json.error}` : ""}`);
h = await me();
ok("resident told the van is coming", h?.conv?.case?.status === "dispatched", h?.driver ?? "");

// The dispatch text carries a private tracking link; the page's data follows the trip.
const linkMsg = [...(h?.messages ?? [])].reverse().find((m: any) => /\/t\/[A-Za-z0-9_-]{10,}/.test(m.text ?? ""));
const trackCode = linkMsg?.text.match(/\/t\/([A-Za-z0-9_-]{10,})/)?.[1];
ok("resident got a tracking link by text", Boolean(trackCode), linkMsg ? `"${linkMsg.text.replace(/\n/g, " ").slice(0, 70)}"` : "no link in messages");
const track = async () => {
  const r = await fetch(`${BASE}/api/track/${trackCode}`);
  return { status: r.status, json: (await r.json().catch(() => ({}))) as any };
};
const page = await fetch(`${BASE}/t/${trackCode}`);
ok("tracking page opens", page.status === 200, String(page.status));
const t1 = await track();
ok("tracking data: van on the way", t1.status === 200 && t1.json.step === "coming", `${t1.status} · ${t1.json.step} · ${t1.json.vehicleName}`);
ok("tracking data has no name or phone", t1.status === 200 && !JSON.stringify(t1.json).includes(PHONE) && !("name" in t1.json) && !("phone" in t1.json));
const bad = await fetch(`${BASE}/api/track/notARealCode123`);
ok("a made-up code is refused", bad.status === 404, String(bad.status));
const trackSteps = new Set<string>([t1.json.step]);

// 4. The trip runs: outside → resident replies IN → on board at once → checked in.
const t0 = Date.now();
let seen = h?.conv?.case?.status;
let saidIn = false;
while (Date.now() - t0 < 8 * 60_000) {
  await sleep(2000);
  h = await me();
  if (trackCode) trackSteps.add((await track()).json.step);
  const st = h?.conv?.case?.status;
  if (st !== seen) {
    console.log(`        ${Math.round((Date.now() - t0) / 1000)}s · ${st} · "${h?.summary ?? ""}"`);
    seen = st;
  }
  const outside = (h?.messages ?? []).some((m: any) => m.from === "evacuaid" && /OUTSIDE/.test(m.text));
  if (outside && !saidIn && st === "dispatched") {
    saidIn = true;
    const r1 = await post("/api/inbound", { phone: PHONE, text: "IN" });
    const after = (await me())?.conv?.case?.status;
    ok('resident replies "IN": on board at once', after === "onboard" && /board/i.test(r1.json.reply ?? ""), `${after} · "${String(r1.json.reply ?? "").slice(0, 50)}"`);
    const r2 = await post("/api/inbound", { phone: PHONE, text: "in" });
    ok('a second "in" sends nothing', (r2.json.reply ?? "") === "", `"${r2.json.reply ?? ""}"`);
    seen = after;
  }
  if (st === "done") break;
}
ok("checked in at the shelter", seen === "done", `${Math.round((Date.now() - t0) / 1000)}s`);
const sent = (h?.messages ?? []).filter((m: any) => m.from === "evacuaid").map((m: any) => m.text as string);
const count = (re: RegExp) => sent.filter((t) => re.test(t)).length;
ok("exactly one of each trip text", [/HELP IS ON THE WAY/, /Track your ride/, /OUTSIDE/, /on board/i, /checked in/i].every((re) => count(re) === 1), ["way", "track", "outside", "board", "in"].map((n, i) => `${n}×${count([/HELP IS ON THE WAY/, /Track your ride/, /OUTSIDE/, /on board/i, /checked in/i][i])}`).join(" "));
ok("safe text reminds them to reply STOP", /STOP/.test(sent.find((t) => /checked in/i.test(t)) ?? ""));
ok("tracking page followed every step", ["coming", "outside", "onboard", "safe"].every((x) => trackSteps.has(x)), [...trackSteps].join(" → "));

// 5. Clean up the fictional resident.
const del = await fetch(`${BASE}/api/roster?phone=${encodeURIComponent(PHONE)}`, { method: "DELETE", headers: H });
ok("fictional resident removed", del.status < 400, String(del.status));
if (trackCode) ok("their tracking link stops working", (await track()).status === 404);

console.log(`\n${failed ? `${failed} FAILED` : "All steps passed"}\n`);
process.exit(failed ? 1 : 0);
