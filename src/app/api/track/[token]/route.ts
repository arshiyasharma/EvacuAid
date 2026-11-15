// The resident's tracking page reads its trip here. Only someone holding the
// code (sent by text) can see it, and only this one trip: no name, no phone.
import { clientIp, throttled } from "@/lib/auth/session";
import { SHELTER } from "@/lib/replay/fleet";
import { findTrack } from "@/lib/live/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/track/[token]">) {
  if (throttled(`track:${clientIp(req)}`, 120, 60_000)) {
    return Response.json({ error: "Slow down a little" }, { status: 429 });
  }
  const { token } = await ctx.params;
  const found = findTrack(token);
  if (!found) return Response.json({ error: "This link has ended." }, { status: 404 });
  const { h, t } = found;
  const c = h.conv.case;
  const sameTrip = c?.vehicleId === t.vehicleId;
  const step = !sameTrip ? "ended" : c?.status === "done" ? "safe" : c?.status === "onboard" ? "onboard" : Date.now() >= t.arriveAt ? "outside" : "coming";
  return Response.json({
    vehicleName: t.vehicleName,
    step,
    language: h.language === "es" ? "es" : "en",
    now: Date.now(),
    dispatchedAt: t.dispatchedAt,
    arriveAt: t.arriveAt,
    boardAt: t.boardAt,
    shelterAt: t.shelterAt,
    etaMin: t.etaMin ?? 5,
    toShelterMin: t.toShelterMin ?? h.tripShelterMin ?? 8,
    van: t.from,
    home: h.location,
    shelter: SHELTER.location,
    shelterName: SHELTER.name,
  });
}
