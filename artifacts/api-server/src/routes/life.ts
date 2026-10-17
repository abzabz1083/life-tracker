import { Router, type IRouter, type RequestHandler } from "express";
import {
  CreateLifeInsightBody,
  IdentifyExerciseMachineBody,
  TranscribeLifeVoiceNoteBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ensureCompatibleFormat,
  speechToText,
} from "@workspace/integrations-openai-ai-server/audio";

const router: IRouter = Router();

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

export default router;
