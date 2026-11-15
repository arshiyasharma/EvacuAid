// Operator: start the drill over. Situation, ledger, bank fund and on-chain caps reset
// together; people who signed up stay on the list.
import { requireOperator } from "@/lib/auth/session";
import { freshFund } from "@/lib/bank/nessie";
import { resetLedger } from "@/lib/bank/service";
import { resetLive } from "@/lib/live/store";
import { newRun } from "@/lib/solana/pool";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  resetLive();
  resetLedger();
  newRun();
  try {
    await freshFund();
  } catch (e) {
    return Response.json({ ok: true, warning: `Bank fund not reset: ${(e as Error).message}` });
  }
  return Response.json({ ok: true });
}
