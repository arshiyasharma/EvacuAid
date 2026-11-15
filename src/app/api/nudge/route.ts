import { requireOperator } from "@/lib/auth/session";
// Re-texts alerted homes that haven't answered; second miss flags a door knock.
import { nudgeSilent } from "@/lib/live/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  return Response.json({ nudged: await nudgeSilent() });
}
