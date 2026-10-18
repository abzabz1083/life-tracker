import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type RequestHandler, type Response } from "express";
import {
  CreateLifeMealPlanBody,
  CreateLifeInsightBody,
  IdentifyExerciseMachineBody,
  ReadLifeNutritionLabelBody,
  SyncLifeReminderSnapshotBody,
  TranscribeLifeVoiceNoteBody,
  UpdateLifeReminderSettingsBody,
} from "@workspace/api-zod";
import { db, lifeReminderConfigs } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ensureCompatibleFormat,
  speechToText,
} from "@workspace/integrations-openai-ai-server/audio";
import {
  decryptTelegramToken,
  encryptTelegramToken,
} from "../lib/telegramTokenEncryption";
import { PASSCODE_OWNER_ID, requirePasscodeSession } from "../lib/passcodeAuth";

const router: IRouter = Router();
router.use(requirePasscodeSession);
const nutritionCache = new Map<
  string,
  { items: Array<Record<string, string | number>>; expiresAt: number }
>();

function authenticatedUserId(res: Response): string {
  return (res.locals.userId as string | undefined) ?? PASSCODE_OWNER_ID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function modelJson(content: string | null | undefined): unknown {
  if (!content) throw new Error("The model returned no content.");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model did not return JSON.");
  return JSON.parse(content.slice(start, end + 1)) as unknown;
}

function isMealPlan(value: unknown): boolean {
  if (!isRecord(value) || typeof value.title !== "string" || typeof value.note !== "string") {
    return false;
  }
  return (
    Array.isArray(value.ingredients) &&
    value.ingredients.length > 0 &&
    value.ingredients.length <= 6 &&
    value.ingredients.every(
      (item) =>
        isRecord(item) &&
        typeof item.food === "string" &&
        typeof item.grams === "number" &&
        Number.isFinite(item.grams) &&
        item.grams > 0 &&
        typeof item.reason === "string",
    )
  );
}

function isNutritionLabel(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.foodName === "string" &&
    typeof value.servingGrams === "number" &&
    Number.isFinite(value.servingGrams) &&
    value.servingGrams > 0 &&
    ["calories", "protein", "carbs", "fat"].every(
      (key) =>
        typeof value[key] === "number" &&
        Number.isFinite(value[key]) &&
        (value[key] as number) >= 0,
    ) &&
    typeof value.labelNotes === "string"
  );
}

const windows = new Map<string, { count: number; resetsAt: number }>();
const aiRateLimit: RequestHandler = (req, res, next) => {
  const now = Date.now();
  const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
  let window = windows.get(key);

  if (!window || window.resetsAt <= now) {
    window = { count: 0, resetsAt: now + 60_000 };
    windows.set(key, window);
  }
  window.count += 1;

  if (window.count > 12) {
    res.status(429).json({ error: "Please wait a minute before trying another AI action." });
    return;
  }

  if (windows.size > 2_000) {
    for (const [address, entry] of windows) {
      if (entry.resetsAt <= now) windows.delete(address);
    }
  }
  next();
};

router.post("/life/insights", aiRateLimit, async (req, res) => {
  try {
    const { snapshot } = CreateLifeInsightBody.parse(req.body);
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "You are a supportive personal planning coach. Give a concise, specific review of the user's tasks, money, learning, meals, and training. Mention one win, one useful pattern, and up to two practical next steps. Be nonjudgmental. Never diagnose or prescribe medical treatment. State uncertainty instead of inventing facts.",
        },
        { role: "user", content: snapshot },
      ],
    });
    const summary = response.choices[0]?.message.content?.trim();
    if (!summary) {
      res.status(502).json({ error: "The review could not be generated. Please try again." });
      return;
    }
    res.json({ summary });
  } catch (error) {
    req.log.error({ err: error }, "Unable to generate life insight");
    res.status(502).json({ error: "The review could not be generated. Please try again." });
  }
});

router.post("/life/transcribe", aiRateLimit, async (req, res) => {
  try {
    const { audioBase64 } = TranscribeLifeVoiceNoteBody.parse(req.body);
    if (audioBase64.length > 12_000_000) {
      res.status(413).json({ error: "That recording is too large. Please record a shorter note." });
      return;
    }
    const source = Buffer.from(audioBase64, "base64");
    const { buffer, format } = await ensureCompatibleFormat(source);
    const transcript = await speechToText(buffer, format);
    res.json({ transcript });
  } catch (error) {
    req.log.error({ err: error }, "Unable to transcribe voice note");
    res.status(502).json({ error: "The voice note could not be transcribed. Please try again." });
  }
});

router.post("/life/identify-exercise", aiRateLimit, async (req, res) => {
  try {
    const { imageBase64, mimeType } = IdentifyExerciseMachineBody.parse(req.body);
    if (imageBase64.length > 8_000_000) {
      res.status(413).json({ error: "Please use a smaller photo." });
      return;
    }
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "Identify the exercise machine or equipment in the photo. Return one concise suggestion with the likely machine name and a brief, cautious setup cue. If uncertain, say so. Do not guess brand or exact machine model.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "What exercise equipment is shown?" },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    });
    const suggestion = response.choices[0]?.message.content?.trim();
    if (!suggestion) {
      res.status(502).json({ error: "The photo could not be identified. Please try again." });
      return;
    }
    res.json({ suggestion });
  } catch (error) {
    req.log.error({ err: error }, "Unable to identify exercise equipment");
    res.status(502).json({ error: "The photo could not be identified. Please try again." });
  }
});

router.post("/life/nutrition-label", aiRateLimit, async (req, res) => {
  const parsed = ReadLifeNutritionLabelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a clear photo of the nutrition panel." });
    return;
  }

  const { imageBase64, mimeType } = parsed.data;
  if (imageBase64.length > 8_000_000) {
    res.status(413).json({ error: "Please use a smaller photo." });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "Read the nutrition facts panel in the supplied food-package photo. Return only a JSON object with foodName, servingGrams, calories, protein, carbs, fat, and labelNotes. Values must be for one labeled serving, not per 100 g. Use grams for servingGrams and grams for protein, carbs, and fat. Do not estimate unreadable values; if the panel or serving weight is unreadable, explain this briefly in labelNotes and use 0 only for the unreadable numeric values. This is a transcription aid, not a substitute for checking the packet.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Read the product name, serving size, and nutrition values." },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });
    const label = modelJson(response.choices[0]?.message.content);
    if (!isNutritionLabel(label)) {
      res.status(502).json({ error: "The label values could not be read reliably. Try a clearer photo." });
      return;
    }
    res.json(label);
  } catch {
    req.log.error("Unable to read nutrition label");
    res.status(502).json({ error: "The label could not be read. Try a clearer photo." });
  }
});

router.get("/life/nutrition-search", aiRateLimit, async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  if (query.length < 2 || query.length > 120) {
    res.status(400).json({ error: "Enter at least two characters to search." });
    return;
  }

  const cacheKey = query.toLocaleLowerCase();
  const cached = nutritionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    res.json(cached.items);
    return;
  }

  const failures: string[] = [];
  try {
    const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    url.searchParams.set("api_key", process.env.USDA_FDC_API_KEY || "DEMO_KEY");
    url.searchParams.set("query", query);
    url.searchParams.set("pageSize", "8");
    url.searchParams.set("dataType", "Foundation,SR Legacy,Survey (FNDDS)");
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (response.ok) {
      const body = (await response.json()) as {
        foods?: Array<{
          fdcId: number;
          description: string;
          foodNutrients?: Array<{
            nutrientName?: string;
            nutrientNumber?: string;
            unitName?: string;
            value?: number;
          }>;
        }>;
      };
      const items = (body.foods ?? [])
        .map((food) => {
          const nutrients = food.foodNutrients ?? [];
          const findNutrient = (predicate: (name: string) => boolean) =>
            nutrients.find((nutrient) =>
              predicate((nutrient.nutrientName ?? "").toLocaleLowerCase()),
            )?.value ?? 0;
          const calories =
            nutrients.find(
              (nutrient) =>
                nutrient.nutrientNumber === "1008" ||
                (nutrient.nutrientName?.toLocaleLowerCase() === "energy" &&
                  nutrient.unitName?.toLocaleUpperCase() === "KCAL"),
            )?.value ?? findNutrient((name) => name.includes("energy"));
          return {
            id: `usda-${food.fdcId}`,
            name: food.description,
            source: "USDA FoodData Central" as const,
            calories,
            protein: findNutrient((name) => name === "protein"),
            carbs: findNutrient((name) => name.includes("carbohydrate")),
            fat: findNutrient((name) => name.includes("total lipid") || name === "fat"),
          };
        })
        .filter((food) => food.name && food.calories > 0);
      if (items.length) {
        nutritionCache.set(cacheKey, { items, expiresAt: Date.now() + 30 * 60_000 });
        res.json(items);
        return;
      }
    } else {
      failures.push(`USDA FoodData Central (${response.status})`);
    }
  } catch {
    failures.push("USDA FoodData Central (network error)");
  }

  try {
    const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "8");
    url.searchParams.set(
      "fields",
      "code,product_name,nutriments",
    );
    const response = await fetch(url, {
      headers: { "user-agent": "LifeTracker nutrition lookup" },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        products?: Array<{
          code?: string;
          product_name?: string;
          nutriments?: Record<string, unknown>;
        }>;
      };
      const items = (body.products ?? [])
        .map((product) => {
          const values = product.nutriments ?? {};
          const value = (key: string) => {
            const found = values[key];
            return typeof found === "number" && Number.isFinite(found) ? found : 0;
          };
          return {
            id: `off-${product.code ?? product.product_name ?? query}`,
            name: product.product_name ?? "",
            source: "Open Food Facts" as const,
            calories: value("energy-kcal_100g"),
            protein: value("proteins_100g"),
            carbs: value("carbohydrates_100g"),
            fat: value("fat_100g"),
          };
        })
        .filter((food) => food.name && food.calories > 0);
      if (items.length) {
        nutritionCache.set(cacheKey, { items, expiresAt: Date.now() + 30 * 60_000 });
        res.json(items);
        return;
      }
    } else {
      failures.push(`Open Food Facts (${response.status})`);
    }
  } catch {
    failures.push("Open Food Facts (network error)");
  }

  if (failures.length === 2) {
    res.status(503).json({
      error: `Nutrition providers did not respond: ${failures.join(", ")}. Try again or scan the package label.`,
    });
    return;
  }
  nutritionCache.set(cacheKey, { items: [], expiresAt: Date.now() + 5 * 60_000 });
  res.json([]);
});

router.post("/life/meal-plan", aiRateLimit, async (req, res) => {
  const parsed = CreateLifeMealPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the foods you want to use." });
    return;
  }

  try {
    const { ingredients, remainingCalories, remainingProtein, eatenToday } = parsed.data;
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1000,
      messages: [
        {
          role: "system",
          content:
            "You are a practical meal-planning assistant. Suggest one meal using only the foods the user asked for, with sensible amounts in grams. Use the remaining calorie and protein targets and today's food log as context. Do not invent nutrition values or claim the meal perfectly hits targets. Return only JSON with title, note, and ingredients (1 to 6 items, each with food, grams, and a short reason). Keep advice non-medical and concise.",
        },
        {
          role: "user",
          content: JSON.stringify({
            ingredients,
            remainingCalories,
            remainingProtein,
            eatenToday,
          }),
        },
      ],
    });
    const suggestion = modelJson(response.choices[0]?.message.content);
    if (!isMealPlan(suggestion)) {
      res.status(502).json({ error: "A meal suggestion could not be created. Please try again." });
      return;
    }
    res.json(suggestion);
  } catch {
    req.log.error("Unable to create a meal suggestion");
    res.status(502).json({ error: "A meal suggestion could not be created. Please try again." });
  }
});

router.get("/life/reminders", async (_req, res) => {
  try {
    const [config] = await db
      .select()
      .from(lifeReminderConfigs)
      .where(eq(lifeReminderConfigs.userId, authenticatedUserId(res)))
      .limit(1);
    res.json({
      chatId: config?.chatId ?? "",
      time: config?.time ?? "09:00",
      timezone: config?.timezone ?? "Asia/Dubai",
      enabled: config?.enabled ?? false,
      tokenConfigured: Boolean(config?.botTokenCiphertext),
    });
  } catch {
    res.status(500).json({ error: "Reminder settings could not be loaded." });
  }
});

router.put("/life/reminders", async (req, res) => {
  const parsed = UpdateLifeReminderSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the Telegram chat ID, time, and timezone." });
    return;
  }

  const { chatId, botToken, time, timezone, enabled } = parsed.data;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    res.status(400).json({ error: "Enter a valid timezone, such as Asia/Dubai." });
    return;
  }

  const userId = authenticatedUserId(res);
  try {
    const [existing] = await db
      .select()
      .from(lifeReminderConfigs)
      .where(eq(lifeReminderConfigs.userId, userId))
      .limit(1);
    let botTokenCiphertext = existing?.botTokenCiphertext ?? null;
    if (botToken === null) botTokenCiphertext = null;
    if (typeof botToken === "string") botTokenCiphertext = encryptTelegramToken(botToken);
    if (enabled && !botTokenCiphertext) {
      res.status(400).json({ error: "Add a bot token before enabling reminders." });
      return;
    }

    const values = {
      userId,
      chatId,
      time,
      timezone,
      enabled,
      botTokenCiphertext,
      updatedAt: new Date(),
    };
    const [saved] = await db
      .insert(lifeReminderConfigs)
      .values(values)
      .onConflictDoUpdate({
        target: lifeReminderConfigs.userId,
        set: {
          chatId,
          time,
          timezone,
          enabled,
          botTokenCiphertext,
          updatedAt: new Date(),
        },
      })
      .returning();
    res.json({
      chatId: saved.chatId,
      time: saved.time,
      timezone: saved.timezone,
      enabled: saved.enabled,
      tokenConfigured: Boolean(saved.botTokenCiphertext),
    });
  } catch {
    res.status(500).json({ error: "Reminder settings could not be saved securely." });
  }
});

router.delete("/life/reminders", async (_req, res) => {
  try {
    await db
      .delete(lifeReminderConfigs)
      .where(eq(lifeReminderConfigs.userId, authenticatedUserId(res)));
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Reminder settings could not be removed." });
  }
});

router.put("/life/reminders/snapshot", async (req, res) => {
  const parsed = SyncLifeReminderSnapshotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Reminder items could not be saved." });
    return;
  }

  try {
    const [existing] = await db
      .select({ userId: lifeReminderConfigs.userId })
      .from(lifeReminderConfigs)
      .where(eq(lifeReminderConfigs.userId, authenticatedUserId(res)))
      .limit(1);
    if (!existing) {
      res.json({ saved: false });
      return;
    }
    await db
      .update(lifeReminderConfigs)
      .set({
        tasks: parsed.data.tasks,
        modules: parsed.data.modules,
        updatedAt: new Date(),
      })
      .where(eq(lifeReminderConfigs.userId, existing.userId));
    res.json({ saved: true });
  } catch {
    res.status(500).json({ error: "Reminder items could not be saved." });
  }
});

router.post("/life/telegram-test", aiRateLimit, async (req, res) => {
  try {
    const [config] = await db
      .select()
      .from(lifeReminderConfigs)
      .where(eq(lifeReminderConfigs.userId, authenticatedUserId(res)))
      .limit(1);
    if (!config?.botTokenCiphertext) {
      res.status(404).json({ sent: false, error: "Save a bot token before testing Telegram." });
      return;
    }

    const token = decryptTelegramToken(config.botTokenCiphertext);
    const response = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: "Life Tracker is connected. Daily reminders are set to " +
            `${config.time} (${config.timezone}).`,
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    const result = (await response.json()) as { ok?: boolean; description?: string };
    if (!response.ok || !result.ok) {
      res.status(502).json({
        sent: false,
        error: result.description?.slice(0, 200) || "Telegram could not send the test message.",
      });
      return;
    }
    res.json({ sent: true });
  } catch {
    req.log.warn("Telegram connection test failed");
    res.status(502).json({
      sent: false,
      error: "Telegram could not be reached. Check the saved bot token and chat ID.",
    });
  }
});

export default router;
