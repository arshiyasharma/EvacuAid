// Landing-page sign-up: put the phone on an iMessage line and place them at a
// random house in the zone. They then text EVAC to their number to connect.
import { clientIp, throttled } from "@/lib/auth/session";
import { assignLine } from "@/lib/live/photon";
import { normalizePhone } from "@/lib/live/phone";
import { addToRoster, randomHouse, snapshot } from "@/lib/live/store";

export const dynamic = "force-dynamic";

// Each sign-up takes a Photon line seat: 3 per address per hour, 40 in total per server run.
const g = globalThis as unknown as { __evacuaidSignups?: Set<string> };
const signups: Set<string> = (g.__evacuaidSignups ??= new Set());
const MAX_SIGNUPS = Number(process.env.MAX_SIGNUPS || 40);

export async function POST(req: Request) {
  if (throttled(`signup:${clientIp(req)}`, 3, 60 * 60_000)) {
    return Response.json({ error: "Too many sign-ups from here. Try again later." }, { status: 429 });
  }
  const { phone: raw, name } = (await req.json().catch(() => ({}))) as { phone?: string; name?: string };
  const phone = normalizePhone(raw ?? "");
  if (!/^\+1\d{10}$/.test(phone)) return Response.json({ error: "Enter a US mobile number" }, { status: 400 });

  if (!signups.has(phone) && signups.size >= MAX_SIGNUPS) {
    return Response.json({ error: "Sign-ups are full for this demo" }, { status: 503 });
  }
  const line = await assignLine(phone, name?.trim() || undefined);
  if (!line.number) return Response.json({ error: line.error ?? "Couldn't add your number" }, { status: 502 });

  signups.add(phone);
  const already = snapshot().households.find((h) => h.phone === phone);
  const h = already ?? addToRoster(name?.trim() || "", phone, randomHouse());
  h.source = "signup";
  return Response.json({ number: line.number, address: h.address });
}
