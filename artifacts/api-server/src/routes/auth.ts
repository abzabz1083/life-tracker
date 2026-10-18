import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  GetLifeTrackerSessionResponse,
  UnlockLifeTrackerBody,
  UnlockLifeTrackerResponse,
} from "@workspace/api-zod";
import { db, lifeReminderConfigs } from "@workspace/db";
import {
  clearFailedPasscodeAttempts,
  clearPasscodeSession,
  issuePasscodeSession,
  PASSCODE_OWNER_ID,
  passcodeAuthConfigured,
  passcodeMatches,
  recordFailedPasscodeAttempt,
  hasValidPasscodeSession,
} from "../lib/passcodeAuth";

const router: IRouter = Router();

async function carryForwardSingleReminderConfig(): Promise<void> {
  const [existingOwner] = await db
    .select({ userId: lifeReminderConfigs.userId })
    .from(lifeReminderConfigs)
    .where(eq(lifeReminderConfigs.userId, PASSCODE_OWNER_ID))
    .limit(1);
  if (existingOwner) return;

  const legacyConfigs = await db
    .select({ userId: lifeReminderConfigs.userId })
    .from(lifeReminderConfigs)
    .limit(2);
  if (legacyConfigs.length !== 1) return;

  await db
    .update(lifeReminderConfigs)
    .set({ userId: PASSCODE_OWNER_ID, updatedAt: new Date() })
    .where(eq(lifeReminderConfigs.userId, legacyConfigs[0].userId));
}

router.get("/auth/session", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const configured = passcodeAuthConfigured();
  res.json(GetLifeTrackerSessionResponse.parse({
    configured,
    authenticated: configured && hasValidPasscodeSession(req),
  }));
});

router.post("/auth/passcode", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  if (!passcodeAuthConfigured()) {
    res.status(503).json({ error: "Passcode access is not configured." });
    return;
  }

  const parsed = UnlockLifeTrackerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a passcode with at least four characters." });
    return;
  }

  const attempts = recordFailedPasscodeAttempt(req);
  if (attempts.blocked) {
    res.setHeader("Retry-After", String(attempts.retryAfterSeconds));
    res.status(429).json({ error: "Too many attempts. Wait a little before trying again." });
    return;
  }

  if (!passcodeMatches(parsed.data.passcode)) {
    res.status(401).json({ error: "That passcode was not accepted." });
    return;
  }

  clearFailedPasscodeAttempts(req);
  try {
    await carryForwardSingleReminderConfig();
  } catch {
    req.log.warn("Could not carry forward the existing reminder settings.");
  }
  res.setHeader("Set-Cookie", issuePasscodeSession(req));
  res.json(UnlockLifeTrackerResponse.parse({ configured: true, authenticated: true }));
});

router.post("/auth/logout", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", clearPasscodeSession(req));
  res.status(204).end();
});

export default router;
