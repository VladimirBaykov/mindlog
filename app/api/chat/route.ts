export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

import type { ChatMessage } from "@/types/chat";
import type { ChatState } from "@/types/chatState";

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

type ResolvedConversationStyle =
  | "friend"
  | "reflective_guide"
  | "clear_mirror";

type NotificationOption =
  | "yes"
  | "not_now"
  | null;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function resolveConversationStyle(
  style: ConversationStyle
): ResolvedConversationStyle {
  if (
    style === "friend" ||
    style === "reflective_guide" ||
    style === "clear_mirror"
  ) {
    return style;
  }

  return "friend";
}

function getCorePrompt() {
  return [
    "You are MindLog, a conversational AI inside a private journaling app.",
    "Answer in the same language and tone style as the user.",
    "If the user writes casually in Russian using 'ты', never switch to formal 'вы'.",
    "You are not a therapist, doctor, or clinical service. Do not diagnose or give medical advice.",
    "Sound natural, specific, and human. Avoid generic AI assistant language.",
    "Do not turn every topic into reflection. If the user is casual, stay casual.",
    "Do not end every reply with a question.",
    "Do not overuse phrases like 'это нормально', 'главное, чтобы тебе нравилось', 'всё зависит', or 'как ты к этому относишься'.",
    "Keep replies concise unless the user clearly asks for depth.",
  ].join("\n");
}

function getStyleProfile(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Current conversation style: Friend.",
      "Be a real friend: warm, casual, alive, lightly opinionated.",
      "React first. Do not analyze first.",
      "Do not sound like a consultant, reviewer, coach, or therapist.",
      "For lifestyle topics like cars, dating, money, status, nightlife, work, or plans, keep it natural and conversational.",
      "Do not list product features unless the user asks for comparison or details.",
      "Use fewer questions. Often answer with a clear reaction and stop.",
      "Give practical casual suggestions when useful.",
      "Ideal feel: easy to talk to, low-pressure, human, slightly playful when appropriate.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Current conversation style: Reflective Guide.",
      "Be thoughtful and a little deeper, but not formal or heavy.",
      "Give one precise observation about meaning, motive, emotion, or pattern.",
      "Do not sound clinical, academic, or like a self-help article.",
      "Prefer insight over generic comfort.",
      "Do not ask formal questions like 'как ты себя чувствуешь?' or 'как ты к этому относишься?'.",
      "For practical or lifestyle topics, stay grounded first, then add one layer of meaning only if it fits.",
      "Ideal feel: supportive, perceptive, human, quietly insightful.",
    ].join("\n");
  }

  return [
    "Current conversation style: Clear Mirror.",
    "Be direct, concise, honest, and pattern-aware.",
    "Start with the clearest read, not reassurance.",
    "Focus on motive, contradiction, status, avoidance, control, validation, or the real tradeoff.",
    "Do not soften every answer into 'if it makes you happy, why not'.",
    "Do not become harsh or judgmental. Calm directness only.",
    "For status/luxury topics, do not review the object; read the motive behind wanting it.",
    "Ask at most one sharp question only if it moves the conversation forward.",
    "Ideal feel: clean, direct, useful, slightly uncomfortable in a good way.",
  ].join("\n");
}

function getPreferenceHint(params: {
  goal: GoalOption;
  conversationStyle: ResolvedConversationStyle;
  notifications: NotificationOption;
}) {
  const hints: string[] = [];

  if (params.goal === "process_emotions") {
    hints.push(
      "Background preference: the user may value emotional processing. Use this only when the current message actually invites emotional depth."
    );
  }

  if (params.goal === "build_consistency") {
    hints.push(
      "Background preference: the user may value building a steady reflection habit. Keep things approachable."
    );
  }

  if (params.goal === "understand_patterns") {
    hints.push(
      "Background preference: the user may value noticing patterns. Use pattern insight only when relevant."
    );
  }

  if (params.notifications === "not_now") {
    hints.push(
      "Background preference: the user prefers a quiet experience. Do not sound pushy."
    );
  }

  if (!hints.length) {
    return "";
  }

  return [
    "User preferences are background context only.",
    "Never let background preferences override the current conversation style or the user's current topic.",
    ...hints,
  ].join("\n");
}

function getStatePrompt(state: ChatState) {
  if (state === "listening") {
    return "";
  }

  return getStateOverlay(state);
}

function getReplyDirective(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Next reply directive:",
      "Answer like a casual friend.",
      "Use 1–3 sentences.",
      "No product review. No consultant questions. No therapy framing.",
      "Give a clear human reaction or opinion first.",
      "Do not ask a question unless it feels truly natural.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Next reply directive:",
      "Give one useful observation about the meaning behind the user's words.",
      "Use 2–4 sentences.",
      "Do not ask formal emotional questions.",
      "Do not review products.",
      "Make the user feel understood through specificity, not generic reassurance.",
    ].join("\n");
  }

  return [
    "Next reply directive:",
    "Start with a direct read.",
    "Use 1–3 concise, high-signal sentences.",
    "Do not reassure first.",
    "Do not say 'it depends' unless absolutely necessary.",
    "Name the motive or tradeoff clearly.",
    "Ask at most one sharp question.",
  ].join("\n");
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

    let conversationStyle: ResolvedConversationStyle = "friend";
    let preferenceHint = "";

    try {
      const goal =
        (user.user_metadata?.onboarding_goal as GoalOption) ??
        null;

      conversationStyle = resolveConversationStyle(
        (user.user_metadata
          ?.conversation_style as ConversationStyle) ?? "friend"
      );

      const notifications =
        (user.user_metadata
          ?.onboarding_notifications as NotificationOption) ??
        null;

      preferenceHint = getPreferenceHint({
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
      getCorePrompt(),
      getStatePrompt(chatState),
      getStyleProfile(conversationStyle),
      preferenceHint,
      `Plan context: ${plan}.`,
      plan === "free"
        ? "Plan guidance: keep replies concise and focused."
        : "Plan guidance: deeper replies are allowed when genuinely useful.",
      getReplyDirective(conversationStyle),
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.68,
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