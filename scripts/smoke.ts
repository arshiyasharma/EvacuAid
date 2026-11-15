export {};
/* eslint-disable @typescript-eslint/no-explicit-any -- loose JSON from our own API */

// Checks every page and API route on a running EvacuAid, local or deployed.
//
//   bun scripts/smoke.ts                          read-only, http://localhost:3000
//   bun scripts/smoke.ts https://evacuaid.us      same checks on the live site
//   bun scripts/smoke.ts https://evacuaid.us --write
//       also sends one web-phone text from a fictional 555 number (exercises Gemini)
//   SMOKE_USER=… SMOKE_PASS=… bun scripts/smoke.ts https://evacuaid.us --operator
//       also signs in as the operator, confirms the session, signs out
//
// Read-only mode changes nothing: write routes are called without a session and
// must refuse (401/403). That proves both that they exist and that they're locked.

const BASE = (process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const WRITE = process.argv.includes("--write");
const OPERATOR = process.argv.includes("--operator");

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const check = (name: string, ok: boolean, detail = "") => results.push({ name, ok, detail });

async function hit(path: string, init: RequestInit = {}) {
  const t = Date.now();
  try {
    const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { Origin: BASE, ...(init.headers ?? {}) } });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, text, json: json as Record<string, any> | null, ms: Date.now() - t, headers: res.headers };
  } catch (e) {
    return { status: 0, text: (e as Error).message, json: null, ms: Date.now() - t, headers: new Headers() };
  }
}

// ---- pages: load, and contain something only the real page has ----
const PAGES: [string, string][] = [
  ["/", "EvacuAid"],
  ["/pitch", "One night, end to end"],
  ["/console", ""],
  ["/relief", ""],
  ["/donate", ""],
  ["/phone", ""],
  ["/login", ""],
];
for (const [path, must] of PAGES) {
  const r = await hit(path);
  const ok = (r.status === 200 || (path === "/console" && r.status >= 300 && r.status < 400)) && (!must || r.text.includes(must));
  check(`page ${path}`, ok, `${r.status} · ${r.ms} ms${must && !r.text.includes(must) ? ` · missing "${must}"` : ""}`);
}

// ---- read APIs: up, and every outside service behind them answered ----
{
  const r = await hit("/api/live");
  const p = r.json?.photon;
  check("GET /api/live", r.status === 200 && Array.isArray(r.json?.households), `${r.status} · ${r.json?.households?.length ?? "?"} households`);
  check("  Photon connected and polling", !!p?.on && !!p?.polling && !p?.error, p ? `on=${p.on} polling=${p.polling} number=${p.number ? "set" : "missing"}${p.error ? ` error=${p.error}` : ""}` : "no photon status");
  const real = (r.json?.households ?? []).filter((h: any) => h.live && !/^\+1\d{3}555\d{4}$/.test(h.phone ?? ""));
  check("  Real phones on the roster", true, `${real.length} (public view hides details; check the console)`);
}
{
  const r = await hit("/api/bank/money");
  check("GET /api/bank/money", r.status === 200, `${r.status} · run ${r.json?.run ?? "?"} · ${r.ms} ms`);
  check("  Nessie relief fund answered", !!r.json?.fund, r.json?.fund ? `fund ${(r.json.fund.availableCents / 100).toLocaleString()} · bridge ${((r.json.fund.bridgeCents ?? 0) / 100).toLocaleString()}` : "no fund (Nessie key or nessie-state.json?)");
  check("  Nessie rescue ops answered", !!r.json?.ops, r.json?.ops ? "ok" : "missing");
  check("  Solana pool answered", !!r.json?.pool, r.json?.pool ? `vault ${((r.json.pool.vaultCents ?? 0) / 100).toLocaleString()}` : "no pool (keypair or solana-state.json?)");
  check("  Run history present", Array.isArray(r.json?.history), `${r.json?.history?.length ?? 0} earlier runs`);
}
{
  const r = await hit("/api/metrics");
  check("GET /api/metrics (Tiger Data)", r.status === 200 && r.json?.ok === true, `${r.status} · ${r.json?.rows ?? "?"} rows · ${r.json?.ms ?? "?"} ms${r.json?.error ? ` · ${r.json.error}` : ""}`);
}
{
  const r = await hit("/api/donate");
  check("GET /api/donate", r.status === 200 && Array.isArray(r.json?.recent), `${r.status} · ${r.json?.recent?.length ?? "?"} recent gifts`);
}

// ---- write APIs: must exist and must refuse without an operator session ----
const LOCKED: [string, string][] = [
  ["POST", "/api/alert"],
  ["POST", "/api/bank/decide"],
  ["POST", "/api/bank/demo"],
  ["POST", "/api/bank/spend"],
  ["POST", "/api/bank/stipend"],
  ["POST", "/api/cases/dispatch"],
  ["POST", "/api/cases/message"],
  ["POST", "/api/nudge"],
  ["POST", "/api/reset"],
  ["POST", "/api/roster"],
  ["PATCH", "/api/roster"],
  ["DELETE", "/api/roster"],
];
for (const [method, path] of LOCKED) {
  const r = await hit(path, { method, body: "{}", headers: { "Content-Type": "application/json" } });
  check(`${method} ${path} locked`, r.status === 401 || r.status === 403, String(r.status));
}

// ---- public write APIs: validate input instead of crashing ----
for (const path of ["/api/signup", "/api/inbound", "/api/donate", "/api/auth/login"]) {
  const r = await hit(path, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
  check(`POST ${path} rejects empty input`, r.status >= 400 && r.status < 500, String(r.status));
}
{
  const r = await hit("/api/inbound", { method: "POST", body: JSON.stringify({ phone: "+14132020000", text: "hi" }), headers: { "Content-Type": "application/json" } });
  check("POST /api/inbound refuses a real-looking number", r.status === 403, String(r.status));
}

// ---- optional: one real conversation turn through Gemini ----
if (WRITE) {
  const r = await hit("/api/inbound", {
    method: "POST",
    body: JSON.stringify({ phone: "+14135550199", text: "my mom uses a wheelchair and we have no car" }),
    headers: { "Content-Type": "application/json" },
  });
  check("Web phone reply (Gemini)", r.status === 200 && typeof r.json?.reply === "string", `${r.status} · ${r.ms} ms · "${String(r.json?.reply ?? r.text).slice(0, 70)}"`);
}

// ---- optional: operator sign-in round trip ----
if (OPERATOR) {
  const u = process.env.SMOKE_USER;
  const p = process.env.SMOKE_PASS;
  if (!u || !p) check("Operator sign-in", false, "set SMOKE_USER and SMOKE_PASS");
  else {
    const r = await hit("/api/auth/login", { method: "POST", body: JSON.stringify({ username: u, password: p }), headers: { "Content-Type": "application/json" } });
    const cookie = r.headers.get("set-cookie")?.split(";")[0] ?? "";
    const secure = /;\s*secure/i.test(r.headers.get("set-cookie") ?? "");
    check("Operator sign-in", r.status === 200 && !!cookie, `${r.status}${BASE.startsWith("https") ? ` · secure cookie ${secure}` : ""}`);
    if (cookie) {
      const live = await hit("/api/live", { headers: { Cookie: cookie } });
      check("  Session recognised", live.json?.operator === true, `operator=${live.json?.operator}`);
      const out = await hit("/api/auth/logout", { method: "POST", headers: { Cookie: cookie } });
      check("  Sign-out", out.status < 400, String(out.status));
    }
  }
}

// ---- report ----
const failed = results.filter((r) => !r.ok);
const w = Math.max(...results.map((r) => r.name.length));
console.log(`\nEvacuAid smoke test · ${BASE}${WRITE ? " · --write" : ""}${OPERATOR ? " · --operator" : ""}\n`);
for (const r of results) console.log(`${r.ok ? "  ok  " : " FAIL "} ${r.name.padEnd(w)}  ${r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` · ${failed.length} FAILED` : ""}\n`);
process.exit(failed.length ? 1 : 0);
