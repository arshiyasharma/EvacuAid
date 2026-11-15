import { requireOperator } from "@/lib/auth/session";
import { spend } from "@/lib/bank/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const { householdId, merchantKey, cents } = (await req.json().catch(() => ({}))) as { householdId?: string; merchantKey?: string; cents?: number };
  if (!householdId || !merchantKey || !cents) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    return Response.json(await spend(householdId, merchantKey, cents));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
