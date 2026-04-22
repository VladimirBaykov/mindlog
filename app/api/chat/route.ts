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
import { resolveUserSubscription } from "@/lib/billing";
import { getChatUsageLimits } from "@/lib/plans";

type GoalOption =
  | "process_emotions"
  | "build_consistency"
  | "understand_patterns"
  | null;

type ConversationStyle =
  | "friend"
  | "reflective_guide"
  | "clear_mirror"
  | null;

type NotificationOption =
  | "yes"
  | "not_now"
  | null;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function getConversationStyleOverlay(style: ConversationStyle) {
  const resolvedStyle = style ?? "friend";

  if (resolvedStyle === "friend") {
    return [
      "Conversation style: Friend.",
      "- Sound like a warm, natural, easy-to-talk-to friend.",
      "- Prioritize flow, ease, and normal human conversation.",
      "- Do not default to emotional check-ins or deep reflective questions.",
      "- Allow light banter, casual reactions, playful energy, and everyday conversation.",
      "- If the user brings lifestyle topics, cars, money, dating, social plans, success, status, work, or daily life, meet them there naturally.",
      "- Be supportive without becoming heavy, therapeutic, or analytical.",
      "- Keep many replies shorter and more conversational.",
      "- Ask simple, natural follow-up questions only when they help the conversation move naturally.",
      "- Do not sound like a therapist, coach, lecturer, or self-help app.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Conversation style: Reflective Guide.",
      "- Be supportive, thoughtful, and a little deeper than a casual friend.",
      "- Help the user name feelings, understand patterns, and reflect with more clarity when the conversation calls for it.",
      "- Stay human, warm, and readable.",
      "- Ask meaningful reflective questions, but do not become clinical, academic, or overly intense.",
      "- Do not over-explain. Keep the tone alive and conversational.",
      "- If the topic is light or casual, you can still stay easy and human before going deeper.",
    ].join("\n");
  }

  return [
    "Conversation style: Clear Mirror.",
    "- Be more direct, focused, and pattern-aware.",
    "- Prioritize clarity, motive, contradiction, behavior, and the core point.",
    "- Do not default to emotional probing or soft therapeutic language.",
    "- If the user brings lifestyle, status, money, dating, purchases, or bold plans, engage directly and intelligently instead of dragging it into feelings.",
    "- Ask sharper, cleaner questions that get to intent, motive, pattern, or truth.",
    "- Use less cushioning, fewer soft emotional fillers, and shorter replies than Reflective Guide.",
    "- Stay respectful and calm. Do not become cold, harsh, or judgmental.",
    "- Sound like honest clarity, not psychology mode.",
  ].join("\n");
}

function buildPreferenceOverlay(params: {
  goal: GoalOption;
  conversationStyle: ConversationStyle;
  notifications: NotificationOption;
}) {
  const blocks: string[] = [];

  if (params.goal === "process_emotions") {
    blocks.push(
      "The user often wants help processing emotions. When emotional material is present, prioritize clarity, gentle unpacking, and useful follow-up questions."
    );
  }

  if (params.goal === "build_consistency") {
    blocks.push(
      "The user often wants to build a reflection habit. Keep the experience approachable, not overwhelming, and reinforce ease and continuity."
    );
  }

  if (params.goal === "understand_patterns") {
    blocks.push(
      "The user often wants help understanding recurring patterns. Notice repetition, triggers, or loops when relevant, but stay human and readable."
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

  const styleOverlay = getConversationStyleOverlay(
    params.conversationStyle
  );

  return [styleOverlay, ...blocks.map((line) => `- ${line}`)].join(
    "\n"
  );
}

function isValidRole(
  value: unknown
): value is ChatMessage["role"] {
  return value === "user" || value === "assistant";
}

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        isValidRole((item as ChatMessage).role) &&
        typeof (item as ChatMessage).content === "string"
    )
    .map((item, index) => ({
      id:
        typeof (item as ChatMessage).id === "string"
          ? (item as ChatMessage).id
          : `msg-${index}`,
      role: (item as ChatMessage).role,
      content: (item as ChatMessage).content.trim(),
    }))
    .filter((item) => item.content.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const messages = normalizeMessages(body.messages);

    if (!messages.length) {
      return NextResponse.json({
        reply: "I’m here with you.",
        chatState: "listening" satisfies ChatState,
      });
    }

    const subscription = await resolveUserSubscription(
      supabase,
      user.id
    );

    const plan = subscription.isPro ? "pro" : "free";
    const limits = getChatUsageLimits(plan);

    if (messages.length > limits.maxMessagesPerConversation) {
      return NextResponse.json(
        {
          error:
            plan === "free"
              ? "Free plan conversation depth reached"
              : "Conversation is too long",
          code: "CHAT_DEPTH_LIMIT",
          plan,
          limit: limits.maxMessagesPerConversation,
          upgradeUrl: plan === "free" ? "/upgrade" : null,
        },
        { status: 403 }
      );
    }

    const longestMessage = messages.reduce(
      (max, message) => Math.max(max, message.content.length),
      0
    );

    if (longestMessage > limits.maxCharactersPerMessage) {
      return NextResponse.json(
        {
          error: "A message is too long",
          code: "MESSAGE_TOO_LONG",
          plan,
          limit: limits.maxCharactersPerMessage,
        },
        { status: 400 }
      );
    }

    const totalCharacters = messages.reduce(
      (sum, message) => sum + message.content.length,
      0
    );

    if (totalCharacters > limits.maxTotalInputCharacters) {
      return NextResponse.json(
        {
          error:
            plan === "free"
              ? "Free plan context limit reached"
              : "Conversation context is too large",
          code: "TOTAL_CONTEXT_LIMIT",
          plan,
          limit: limits.maxTotalInputCharacters,
          upgradeUrl: plan === "free" ? "/upgrade" : null,
        },
        { status: 403 }
      );
    }

    let preferenceOverlay = "";

    try {
      const goal =
        (user.user_metadata?.onboarding_goal as GoalOption) ??
        null;

      const conversationStyle =
        (user.user_metadata
          ?.conversation_style as ConversationStyle) ??
        "friend";

      const notifications =
        (user.user_metadata
          ?.onboarding_notifications as NotificationOption) ??
        null;

      preferenceOverlay = buildPreferenceOverlay({
        goal,
        conversationStyle,
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
      `Plan context: ${plan}.`,
      "General guidance: do not force introspection in casual conversation. Let the user decide when the conversation becomes deeper.",
      plan === "free"
        ? "Free plan guidance: keep responses helpful, concise, and focused. Do not over-extend or produce unnecessarily long answers."
        : "Pro plan guidance: deeper reflection is allowed when it genuinely helps the user.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85,
      messages: [
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

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "I’m here with you.";

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