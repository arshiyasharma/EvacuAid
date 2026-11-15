// Operator: write to a resident (or ask a question) straight from the console.
import { requireOperator } from "@/lib/auth/session";
import { messageCase } from "@/lib/bank/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireOperator(req);
  if (denied) return denied;
  const { householdId, text, at } = (await req.json().catch(() => ({}))) as { householdId?: string; text?: string; at?: number };
  if (!householdId || !text?.trim()) return Response.json({ error: "householdId and text required" }, { status: 400 });
  return Response.json(await messageCase(householdId, text.trim().slice(0, 600), typeof at === "number" ? at : undefined));
}
