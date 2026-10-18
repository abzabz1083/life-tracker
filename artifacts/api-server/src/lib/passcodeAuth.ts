import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";

export const PASSCODE_OWNER_ID = "life-tracker-single-user";
const SESSION_COOKIE = "life_tracker_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;
const FAILED_ATTEMPT_LIMIT = 5;
const FAILED_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type FailedAttempts = { count: number; resetAt: number };
const failedAttempts = new Map<string, FailedAttempts>();

export function passcodeAuthConfigured(): boolean {
  return Boolean(process.env.LIFE_TRACKER_PASSCODE && process.env.SESSION_SECRET);
}

function readSessionCookie(request: Request): string | null {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    return cookie.slice(separator + 1).trim() || null;
  }
  return null;
}

function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({
    sub: PASSCODE_OWNER_ID,
    exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function hasValidPasscodeSession(request: Request): boolean {
  if (!passcodeAuthConfigured()) return false;
  const token = readSessionCookie(request);
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const suppliedSignature = Buffer.from(token.slice(separator + 1), "base64url");
  const expectedSignature = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(payload)
    .digest();
  if (
    suppliedSignature.length !== expectedSignature.length
    || !timingSafeEqual(suppliedSignature, expectedSignature)
  ) return false;

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
    };
    return claims.sub === PASSCODE_OWNER_ID
      && typeof claims.exp === "number"
      && claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function setSessionCookie(request: Request, value: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=None; Max-Age=${maxAge}; Secure`;
}

function attemptKey(request: Request): string {
  const address = request.ip || request.socket.remoteAddress || "unknown";
  return createHash("sha256").update(address).digest("hex");
}

export function recordFailedPasscodeAttempt(request: Request): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const key = attemptKey(request);
  let entry = failedAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + FAILED_ATTEMPT_WINDOW_MS };
    failedAttempts.set(key, entry);
  }
  if (failedAttempts.size > 10_000) {
    for (const [storedKey, storedEntry] of failedAttempts) {
      if (storedEntry.resetAt <= now) failedAttempts.delete(storedKey);
    }
  }
  if (entry.count >= FAILED_ATTEMPT_LIMIT) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  entry.count += 1;
  return { blocked: false, retryAfterSeconds: 0 };
}

export function clearFailedPasscodeAttempts(request: Request): void {
  failedAttempts.delete(attemptKey(request));
}

export function passcodeMatches(supplied: string): boolean {
  const expected = process.env.LIFE_TRACKER_PASSCODE;
  if (!expected) return false;
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(suppliedHash, expectedHash);
}

export function issuePasscodeSession(request: Request): string {
  const token = createSessionToken();
  return setSessionCookie(request, token, SESSION_LIFETIME_SECONDS);
}

export function clearPasscodeSession(request: Request): string {
  return setSessionCookie(request, "", 0);
}

export const requirePasscodeSession: RequestHandler = (request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  if (!passcodeAuthConfigured()) {
    response.status(503).json({ error: "Passcode access is not configured." });
    return;
  }
  if (!hasValidPasscodeSession(request)) {
    response.status(401).json({ error: "Enter the tracker passcode to continue." });
    return;
  }
  response.locals.userId = PASSCODE_OWNER_ID;
  next();
};
