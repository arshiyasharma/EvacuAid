import { cookies } from "next/headers";
import { checkCredentials, clientIp, createSessionToken, SESSION_COOKIE, sessionCookieOptions, throttled } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 5 tries per 10 minutes per address.
  if (throttled(`login:${clientIp(req)}`, 5, 10 * 60_000)) {
    return Response.json({ error: "Too many tries. Wait 10 minutes." }, { status: 429 });
  }
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  if (!username || !password || !checkCredentials(username.trim(), password)) {
    return Response.json({ error: "Wrong username or password" }, { status: 401 });
  }
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(username.trim()), sessionCookieOptions);
  return Response.json({ ok: true });
}
