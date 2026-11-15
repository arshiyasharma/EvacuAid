// Health check for every key in .env.local. Prints results, never secrets.
// Run: bun --env-file=.env.local scripts/check-keys.ts
import { GoogleGenAI } from "@google/genai";
import { SQL } from "bun";

async function gemini() {
  const ai = new GoogleGenAI({});
  const t0 = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = await ai.interactions.create({
    model: "gemini-4-hydrogen",
    input:
      'Resident text: "somos 4, mi abuela usa oxígeno y no tenemos carro". Reply with JSON only: {"people":n,"medical":bool,"noTransport":bool,"language":"xx"}',
  });
  console.log(`GEMINI  ok  status=${r.status} ms=${Date.now() - t0}`);
  console.log(`        usage=${JSON.stringify(r.usage)}`);
  console.log(`        reply=${r.output_text}`);
}

async function tiger() {
  const sql = new SQL(process.env.TIGER_DATABASE_URL!);
  const [v] = await sql`select version() as v`;
  const ext = await sql`select extversion from pg_extension where extname = 'timescaledb'`;
  console.log(`TIGER   ok  ${String(v.v).split(",")[0]} | timescaledb ${ext[0]?.extversion ?? "not enabled"}`);
  await sql.close();
}

async function nessie() {
  const res = await fetch("https://v2-prod-api.nessieisreal.com/accounts", {
    headers: { Authorization: `Bearer ${process.env.NESSIE_API}` },
  });
  console.log(`NESSIE  ${res.ok ? "ok " : "ERR"} HTTP ${res.status}`);
}

async function maptiler() {
  const res = await fetch(
    `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY}`,
  );
  console.log(`MAPTILER ${res.ok ? "ok " : "ERR"} HTTP ${res.status}`);
}

async function firms() {
  const res = await fetch(
    `https://firms.modaps.eosdis.nasa.gov/api/mapkey_status/?MAP_KEY=${process.env.FIRMS_MAP_KEY}`,
  );
  const body = await res.json().catch(() => ({}));
  console.log(`FIRMS   ${res.ok && "transaction_limit" in body ? "ok " : "ERR"} limit=${body.transaction_limit ?? "?"}`);
}

for (const [name, fn] of [
  ["GEMINI", gemini],
  ["TIGER", tiger],
  ["NESSIE", nessie],
  ["MAPTILER", maptiler],
  ["FIRMS", firms],
] as const) {
  try {
    await fn();
  } catch (e) {
    console.log(`${name}  ERR ${(e as Error).message}`);
  }
}
