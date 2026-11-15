// Operator: send a vehicle to a household. Billed to County Emergency Operations.
import { requireOperator } from "@/lib/auth/session";
import { dispatchCase } from "@/lib/bank/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const { householdId, vehicleId, at } = (await req.json().catch(() => ({}))) as { householdId?: string; vehicleId?: string; at?: number };
  if (!householdId || !vehicleId) return Response.json({ error: "householdId and vehicleId required" }, { status: 400 });
  try {
    return Response.json(await dispatchCase(householdId, vehicleId, typeof at === "number" ? at : undefined));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
