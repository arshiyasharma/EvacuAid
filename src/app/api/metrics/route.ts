// Public: live incident metrics from Tiger Data's continuous aggregate (counts and dollars only).
import { currentRun } from "@/lib/activity";
import { metrics } from "@/lib/tiger";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await metrics(currentRun()));
}
