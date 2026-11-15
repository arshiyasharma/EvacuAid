import { isOperator } from "@/lib/auth/session";
import { activityHistory, currentRun, recentActivity } from "@/lib/activity";
import { moneySnapshot } from "@/lib/bank/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await moneySnapshot();
  const activity = recentActivity(60);
  const run = currentRun();
  // History is public too: it only ever names public labels.
  const history = activityHistory().slice(0, 10);
  if (await isOperator()) return Response.json({ ...snap, activity, run, history, operator: true });
  // Public ledger: amounts, checks and stores stay; real residents' names don't.
  const anon = (id: string, label: string) => (id.startsWith("live-") ? "Live resident" : label);
  return Response.json({
    ...snap,
    operator: false,
    activity,
    run,
    history,
    stipends: snap.stipends.map((s) => ({ ...s, label: anon(s.householdId, s.label) })),
    spends: snap.spends.map((s) => ({ ...s, label: anon(s.householdId, s.label) })),
  });
}
