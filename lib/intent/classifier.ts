// src/lib/intent/classifier.ts

import type { Intent } from "@/types/intent";
import type { IntentResult } from "@/types/intent-result";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SYSTEM_PROMPT = `
You are an intent classifier inside the MindLog app.

Your task is to determine WHY the user is writing, not WHAT they are writing.

Choose exactly ONE intent from this list:
- share
- ask
- reflect
- vent
- silence
- check-in
- boundary
- end

Rules:
- Always choose the closest intent.
- Keep confidence between 0 and 1.
- Return ONLY valid JSON.
- Do not explain your choice.
- Do not add extra fields.

Output format:
{
  "intent": "<intent>",
  "confidence": 0.0
}
`;

export async function classifyIntent(
  text: string
): Promise<IntentResult> {
  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: text,
        },
      ],
      text: {
        format: { type: "json_object" },
      },
    });

    const json =
      response?.output?.[0]?.content?.[0]?.json_value ??
      JSON.parse(response.output_text || "{}");

    return sanitize(json);
  } catch (error) {
    console.error("[INTENT CLASSIFIER ERROR]", error);

    return {
      intent: "share",
      confidence: 0.3,
    };
  }
}

// -------------------------
// helpers
// -------------------------

function sanitize(data: any): IntentResult {
  const intent = data?.intent;
  const confidence = Number(data?.confidence);

  if (
    !intent ||
    typeof intent !== "string" ||
    typeof confidence !== "number"
  ) {
    return {
      intent: "share",
      confidence: 0.3,
    };
  }

  return {
    intent: intent as Intent,
    confidence: clamp(confidence, 0, 1),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
