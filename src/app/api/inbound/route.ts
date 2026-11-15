// Web phone: a resident's reply without SMS. Same pipeline as iMessage.
// The public may only use fictional 555 numbers, so nobody can text "as" a real resident.
import { clientIp, isOperator, throttled } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/live/phone";
import { isDemoPhone } from "@/lib/live/redact";
import { handleInbound } from "@/lib/live/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { phone, text } = (await req.json().catch(() => ({}))) as { phone?: string; text?: string };
  if (!phone || !text?.trim()) return Response.json({ error: "phone and text required" }, { status: 400 });
  const operator = await isOperator();
  if (!operator && !isDemoPhone(normalizePhone(phone))) {
    return Response.json({ error: "The web phone only uses demo numbers" }, { status: 403 });
  }
  if (!operator && throttled(`inbound:${clientIp(req)}`, 30, 60_000)) {
    return Response.json({ error: "Slow down a little" }, { status: 429 });
  }
  const r = await handleInbound(phone, text.trim().slice(0, 500), { replyBySms: false });
  return Response.json({ reply: r.reply, triage: r.triage });
}
