import { isOperator } from "@/lib/auth/session";
import { photonStatus } from "@/lib/live/photon";
import { redactHousehold } from "@/lib/live/redact";
import { snapshot } from "@/lib/live/store";
import { opsSnapshot } from "@/lib/ops/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const snap = snapshot();
  if (await isOperator()) {
    return Response.json({ ...snap, operator: true, photon: photonStatus(), ops: opsSnapshot() });
  }
  const p = photonStatus();
  return Response.json({
    ...snap,
    households: snap.households.map(redactHousehold),
    operator: false,
    ops: { dispatches: opsSnapshot().dispatches, messages: [], bills: [], version: opsSnapshot().version },
    photon: { on: p.on, number: p.number, polling: p.polling, connected: 0, error: null },
  });
}
