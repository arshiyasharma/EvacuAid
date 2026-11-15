import { requireOperator } from "@/lib/auth/session";
import { decide } from "@/lib/bank/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const { householdId, approve } = (await req.json().catch(() => ({}))) as { householdId?: string; approve?: boolean };
  if (!householdId || typeof approve !== "boolean") return Response.json({ error: "bad request" }, { status: 400 });
  try {
    return Response.json(await decide(householdId, approve));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
