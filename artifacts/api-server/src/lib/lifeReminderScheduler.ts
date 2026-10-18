import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db, lifeReminderConfigs, type ReminderModule, type ReminderTask } from "@workspace/db";
import { logger } from "./logger";
import { decryptTelegramToken } from "./telegramTokenEncryption";

function localClock(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function reminderMessage(
  date: string,
  tasks: ReminderTask[],
  modules: ReminderModule[],
): string {
  const taskLines = tasks
    .filter((task) => task.date === date && !task.done)
    .slice(0, 20)
    .map((task) => `• ${task.title}`);
  const moduleLines = modules
    .filter((module) => !module.done)
    .slice(0, 20)
    .map((module) => `• ${module.category} · Module ${module.moduleNumber}: ${module.title}`);

  if (taskLines.length === 0 && moduleLines.length === 0) return "";

  const sections = ["Life Tracker — items still to check off today"];
  if (taskLines.length) sections.push(`Daily tasks\n${taskLines.join("\n")}`);
  if (moduleLines.length) sections.push(`Study modules\n${moduleLines.join("\n")}`);
  return sections.join("\n\n").slice(0, 3900);
}

async function sendReminder(
  token: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    const result = (await response.json()) as { ok?: boolean };
    return response.ok && result.ok === true;
  } catch {
    return false;
  }
}

let polling = false;

async function pollReminders(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const configs = await db
      .select()
      .from(lifeReminderConfigs)
      .where(eq(lifeReminderConfigs.enabled, true));

    for (const config of configs) {
      let clock: ReturnType<typeof localClock>;
      try {
        clock = localClock(config.timezone);
      } catch {
        logger.warn("Telegram reminder skipped because its timezone is invalid");
        continue;
      }

      const [hour, minute] = config.time.split(":").map(Number);
      if (clock.minutes < hour * 60 + minute || config.lastSentDate === clock.date) {
        continue;
      }

      const text = reminderMessage(
        clock.date,
        config.tasks ?? [],
        config.modules ?? [],
      );
      if (!text || !config.botTokenCiphertext) continue;

      // Claim this local calendar date before sending so multiple server
      // instances cannot deliver duplicate reminders.
      const [claim] = await db
        .update(lifeReminderConfigs)
        .set({ lastSentDate: clock.date, updatedAt: new Date() })
        .where(
          and(
            eq(lifeReminderConfigs.userId, config.userId),
            or(
              isNull(lifeReminderConfigs.lastSentDate),
              ne(lifeReminderConfigs.lastSentDate, clock.date),
            ),
          ),
        )
        .returning({ userId: lifeReminderConfigs.userId });
      if (!claim) continue;

      let sent = false;
      try {
        const token = decryptTelegramToken(config.botTokenCiphertext);
        sent = await sendReminder(token, config.chatId, text);
      } catch {
        sent = false;
      }

      if (!sent) {
        await db
          .update(lifeReminderConfigs)
          .set({ lastSentDate: null, updatedAt: new Date() })
          .where(eq(lifeReminderConfigs.userId, config.userId));
        logger.warn("Telegram daily reminder could not be sent");
      }
    }
  } catch {
    logger.error("Telegram reminder scheduler could not check due reminders");
  } finally {
    polling = false;
  }
}

export function startLifeReminderScheduler(): void {
  const timer = setInterval(() => void pollReminders(), 60_000);
  timer.unref();
  void pollReminders();
}
