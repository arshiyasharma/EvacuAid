// Operator access. One admin account, set with `bun scripts/set-admin.ts`:
// ADMIN_USERNAME + ADMIN_PASSWORD_HASH (scrypt, salted) + SESSION_SECRET.
// The session is a signed, HttpOnly cookie. Every write API checks it on the
// server; the UI hiding buttons is only a convenience.

import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "evacuaid_operator";
const SESSION_HOURS = 12;

const adminConfigured = () => Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH && process.env.SESSION_SECRET);

/** Local development with no admin set up yet: open, and the UI says so. Never in production. */
export const devOpen = () => process.env.NODE_ENV === "development" && !adminConfigured();

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export function verifyPassword(password: string, stored: string): boolean {
  // Format: scrypt:N:salt:hash (base64url). No "$": .env loaders expand it.
  const [scheme, n, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  if (expected.length < 16) return false;
  const got = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(n) || 16384 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function checkCredentials(username: string, password: string): boolean {
  if (!adminConfigured()) return false;
  const userOk =
    username.length === process.env.ADMIN_USERNAME!.length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(process.env.ADMIN_USERNAME!));
  // Always run the hash so a wrong username takes as long as a wrong password.
  const passOk = verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!);
  return userOk && passOk;
}

export async function createSessionToken(username: string) {
  return new SignJWT({ role: "operator" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_HOURS * 3600,
};

async function validToken(token: string | undefined): Promise<boolean> {
  if (!token || !adminConfigured()) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.role === "operator" && payload.sub === process.env.ADMIN_USERNAME;
  } catch {
    return false;
  }
}

/** For Server Components and Route Handlers. */
export async function isOperator(): Promise<boolean> {
  if (devOpen()) return true;
  return validToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Gate for write APIs. Returns a 401/403 Response to send back, or null when allowed.
 * Also refuses cross-site requests (the cookie is SameSite=Lax; this is belt and braces).
 */
export async function requireOperator(req: Request): Promise<Response | null> {
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return Response.json({ error: "Cross-site request refused" }, { status: 403 });
    }
  }
  if (await isOperator()) return null;
  return Response.json({ error: "Operator sign-in required" }, { status: 401 });
}

// ---- simple per-IP throttle (login, public sign-up) ----

const g = globalThis as unknown as { __evacuaidThrottle?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__evacuaidThrottle ??= new Map());

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** True if this key is over `max` hits in the last `windowMs`. Records the hit. */
export function throttled(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
