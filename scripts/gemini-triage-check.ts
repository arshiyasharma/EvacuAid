// Runs real messages through Gemini triage and prints what it understood.
// Run: bun --env-file=.env.local scripts/gemini-triage-check.ts
import { triageWithGemini } from "../src/lib/gemini";

const samples = [
  "my mom can't walk and the car's in the shop",
  "somos 4, mi abuela usa oxígeno y no tenemos carro",
  "2",
  "we can't afford a hotel where do we go",
  "already at my sister's, all good",
];

for (const s of samples) {
  const r = await triageWithGemini(s);
  console.log(`${r.engine} ${r.ms}ms | ${r.status} ${JSON.stringify(r.needs)} [${r.language}] ${r.summary}\n   → ${r.reply}`);
}
