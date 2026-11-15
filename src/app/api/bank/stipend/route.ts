import { requireOperator } from "@/lib/auth/session";
import { NotEligible, stipendFor } from "@/lib/bank/service";
import { AID_KINDS, type AidKind } from "@/lib/budget";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const { householdId, noTransport, at, kind, override } = (await req.json().catch(() => ({}))) as {
    householdId?: string;
    noTransport?: boolean;
    at?: number;
    kind?: string;
    /** The operator confirmed going past the household cap. */
    override?: boolean;
  };
  const aid: AidKind = kind && kind in AID_KINDS ? (kind as AidKind) : "full";
  if (!householdId) return Response.json({ error: "householdId required" }, { status: 400 });
  try {
    return Response.json(await stipendFor(householdId, { noTransport }, typeof at === "number" ? at : undefined, aid, override === true));
  } catch (e) {
    const status = e instanceof NotEligible ? 403 : 502;
    return Response.json({ error: (e as Error).message, eligible: !(e instanceof NotEligible) }, { status });
  }
}
