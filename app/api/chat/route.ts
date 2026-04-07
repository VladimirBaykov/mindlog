export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import type { ChatMessage } from "@/types/chat";
import type { ChatState } from "@/types/chatState";

import { BASE_SYSTEM_PROMPT } from "@/lib/prompts/systemPrompt";
import { getStateOverlay } from "@/lib/prompts/stateOverlay";
import { detectIntent } from "@/lib/intent/detectIntent";
import { resolveChatState } from "@/lib/state/resolveChatState";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type GoalOption =
  | "process_emotions"
  | "build_consistency"
  | "understand_patterns"
  | null;

type MoodOption =
  | "gentle"
  | "balanced"
  | "direct"
  | null;

type NotificationOption =
  | "yes"
  | "not_now"
  | null;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function buildPreferenceOverlay(params: {
  goal: GoalOption;
  moodPreference: MoodOption;
  notifications: NotificationOption;
}) {
  const blocks: string[] = [];

  if (params.goal === "process_emotions") {
    blocks.push(
      "The user primarily wants help processing emotions. Prioritize emotional clarity, gentle unpacking, and reflective follow-up questions."
    );
  }

  if (params.goal === "build_consistency") {
    blocks.push(
      "The user primarily wants to build a consistent reflection habit. Keep the experience approachable, not overwhelming, and reinforce small reflective momentum."
    );
  }

  if (params.goal === "understand_patterns") {
    blocks.push(
      "The user primarily wants to understand recurring inner patterns. Help them notice themes, triggers, repetition, and emotional loops without sounding clinical."
    );
  }

  if (params.moodPreference === "gentle") {
    blocks.push(
      "Preferred tone: gentle. Be warm, calm, soft, and emotionally safe. Avoid sounding sharp, cold, or overly analytical."
    );
  }

  if (params.moodPreference === "balanced") {
    blocks.push(
      "Preferred tone: balanced. Be warm and supportive, but also clear and grounded."
    );
  }

  if (params.moodPreference === "direct") {
    blocks.push(
      "Preferred tone: direct. Stay thoughtful and kind, but be a little clearer, more focused, and more concise when useful."
    );
  }

  if (params.notifications === "yes") {
    blocks.push(
      "The user is likely open to building an ongoing reflection habit over time. Support continuity gently when relevant."
    );
  }

  if (params.notifications === "not_now") {
    blocks.push(
      "The user prefers a quieter experience. Do not sound pushy, productivity-heavy, or reminder-like."
    );
  }

  if (!blocks.length) {
    return "";
  }

  return [
    "User reflection preferences:",
    ...blocks.map((line) => `- ${line}`),
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];

    if (!messages.length) {
      return NextResponse.json({
        reply: "I’m here with you.",
        chatState: "listening" satisfies ChatState,
      });
    }

    let preferenceOverlay = "";

    try {
      const supabase = await createSupabaseServerClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const goal =
        (user?.user_metadata?.onboarding_goal as GoalOption) ??
        null;

      const moodPreference =
        (user?.user_metadata
          ?.onboarding_mood_preference as MoodOption) ?? null;

      const notifications =
        (user?.user_metadata
          ?.onboarding_notifications as NotificationOption) ??
        null;

      preferenceOverlay = buildPreferenceOverlay({
        goal,
        moodPreference,
        notifications,
      });
    } catch (error) {
      console.warn("Preference overlay load failed:", error);
    }

    const intent = detectIntent(messages);
    const chatState = resolveChatState(intent, messages);

    const systemPrompt = [
      BASE_SYSTEM_PROMPT,
      getStateOverlay(chatState),
      preferenceOverlay,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      ],
    });

    let reply = "I’m here with you.";

    if (response.output_text) {
      reply = response.output_text;
    }

    return NextResponse.json({
      reply,
      chatState,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      {
        reply: "Something went quiet for a moment. Want to try again?",
        chatState: "calm_presence" satisfies ChatState,
      },
      { status: 200 }
    );
  }
}