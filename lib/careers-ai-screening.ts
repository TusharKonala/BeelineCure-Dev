import { AiRecommendation } from "@/generated/prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/db";

const screeningResultSchema = z.object({
  score: z.number().int().min(1).max(10),
  summary: z.string().min(1).max(2000),
  recommendation: z.enum(["shortlist", "reject"]),
});

function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(candidate);
}

async function callAnthropicWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxAttempts = 3,
): Promise<Anthropic.Message> {
  let waitMs = 1000;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      lastError = err;
      if (status !== 529 || attempt === maxAttempts) {
        throw err;
      }
      console.warn(
        `[careers-ai] Anthropic 529 (attempt ${attempt}/${maxAttempts}); waiting ${waitMs}ms`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
      waitMs *= 2;
    }
  }
  throw lastError;
}

export async function screenCareersApplication(applicationId: string) {
  const application = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      resumeText: true,
      coverNote: true,
      jobPosting: {
        select: {
          title: true,
          description: true,
        },
      },
    },
  });

  if (!application) {
    return { skipped: true, reason: "not_found" as const };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error("[careers-ai] ANTHROPIC_API_KEY is not configured");
    return { skipped: true, reason: "no_api_key" as const };
  }

  const userContent = [
    `Job title: ${application.jobPosting.title}`,
    `Job description:\n${application.jobPosting.description}`,
    `Resume:\n${application.resumeText}`,
    application.coverNote
      ? `Cover note:\n${application.coverNote}`
      : "Cover note: (none)",
  ].join("\n\n");

  const message = await callAnthropicWithRetry({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `${userContent}\n\nRespond with only a JSON object with exactly these fields:\n- score: integer 1-10 (fit for the role)\n- summary: string, 2-3 lines on fit\n- recommendation: either "shortlist" or "reject"`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    console.error("[careers-ai] No text in model response");
    return { skipped: true, reason: "empty_response" as const };
  }

  let parsed: z.infer<typeof screeningResultSchema>;
  try {
    const raw = parseJsonFromModelText(textBlock.text);
    parsed = screeningResultSchema.parse(raw);
  } catch (err) {
    console.error("[careers-ai] Failed to parse model JSON:", err);
    return { skipped: true, reason: "parse_error" as const };
  }

  const aiRecommendation =
    parsed.recommendation === "shortlist"
      ? AiRecommendation.SHORTLIST
      : AiRecommendation.REJECT;

  await prisma.jobApplication.update({
    where: { id: applicationId },
    data: {
      aiScore: parsed.score,
      aiSummary: parsed.summary.trim(),
      aiRecommendation,
    },
  });

  return {
    ok: true,
    score: parsed.score,
    recommendation: aiRecommendation,
  };
}
