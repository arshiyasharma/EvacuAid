import { requireOperator } from "@/lib/auth/session";
import { addToRoster, removeFromRoster, setAlertsOn } from "@/lib/live/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const { name, phone } = (await req.json().catch(() => ({}))) as { name?: string; phone?: string };
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    return Response.json({ error: "Enter a full phone number." }, { status: 400 });
  }
  const h = addToRoster(name?.trim() ?? "", phone);
  h.source ??= "operator";
  return Response.json(h);
}

/** Toggle whether "Send alert" texts this phone. */
export async function PATCH(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const { phone, alertsOn } = (await req.json().catch(() => ({}))) as { phone?: string; alertsOn?: boolean };
  if (!phone || typeof alertsOn !== "boolean") return Response.json({ error: "phone and alertsOn required" }, { status: 400 });
  const h = setAlertsOn(phone, alertsOn);
  return h ? Response.json({ ok: true }) : Response.json({ error: "Not on the list" }, { status: 404 });
}

export async function DELETE(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const phone = new URL(req.url).searchParams.get("phone");
  if (!phone) return Response.json({ error: "phone required" }, { status: 400 });
  removeFromRoster(phone);
  return Response.json({ ok: true });
}
