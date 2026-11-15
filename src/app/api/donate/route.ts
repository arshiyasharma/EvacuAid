// Public: give to the relief pool (devnet test money, real on-chain transaction),
// and see exactly where a gift went.
import { clientIp, throttled } from "@/lib/auth/session";
import { donorReceipt } from "@/lib/bank/service";
import { donate, donations } from "@/lib/solana/pool";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const r = await donorReceipt(id);
    return r ? Response.json(r) : Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({
    recent: [...donations()].reverse().slice(0, 12).map((d) => ({ id: d.id, at: d.at, cents: d.cents, name: d.name, sig: d.sig })),
  });
}

export async function POST(req: Request) {
  if (throttled(`donate:${clientIp(req)}`, 3, 60 * 60_000)) {
    return Response.json({ error: "That's a lot of giving! Try again in an hour." }, { status: 429 });
  }
  const { amountUsd, name } = (await req.json().catch(() => ({}))) as { amountUsd?: number; name?: string };
  const usd = Math.round(Number(amountUsd));
  if (!Number.isFinite(usd) || usd < 5 || usd > 25_000) return Response.json({ error: "Give between $5 and $25,000 (test dollars)" }, { status: 400 });
  try {
    const d = await donate(usd * 100, (name ?? "").trim().slice(0, 40));
    return Response.json({ id: d.id, sig: d.sig, cents: d.cents });
  } catch (e) {
    return Response.json({ error: (e as Error).message.split("\n")[0] }, { status: 502 });
  }
}
