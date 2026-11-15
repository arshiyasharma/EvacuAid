import { requireOperator } from "@/lib/auth/session";
// Runs a handful of real stipend requests so the relief dashboard has a night to show.
import { seedDemoNight } from "@/lib/bank/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  return Response.json({ results: await seedDemoNight() });
}
