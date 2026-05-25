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

type NotificationOption = "yes" | "not_now" | null;

type ReplyContext =
  | "casual"
  | "practical"
  | "emotional"
  | "honesty"
  | "default";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function getChatModel() {
  return process.env.OPENAI_CHAT_MODEL || "gpt-5.4-mini";
}

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

function getMaxCompletionTokens(params: {
  style: ResolvedConversationStyle;
  context: ReplyContext;
}) {
  const { style, context } = params;

  if (style === "friend") {
    if (context === "emotional") return 90;
    if (context === "practical") return 75;
    return 65;
  }

  if (style === "reflective_guide") {
    if (context === "emotional") return 120;
    if (context === "practical") return 105;
    return 95;
  }

  if (context === "emotional") return 110;
  if (context === "practical") return 95;
  return 85;
}

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user");
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function inferReplyContext(messages: ChatMessage[]): ReplyContext {
  const lastUserMessage = getLastUserMessage(messages);
  const text = lastUserMessage?.content.toLowerCase() || "";

  if (!text) {
    return "default";
  }

  const practicalMarkers = [
    "what should i write",
    "what to write",
    "what should i do",
    "what do i say",
    "how should i say",
    "how do i text",
    "how should i text",
    "give me a line",
    "give me an example",
    "help me write",
    "help me reply",
    "any advice",
    "what's the move",
    "what is the move",
    "which one",
    "what should i choose",
  ];

  const honestyMarkers = [
    "honestly",
    "be honest",
    "real talk",
    "tell me straight",
    "straight up",
    "is it too much",
    "too much",
    "overkill",
    "am i wrong",
    "what do you really think",
    "what do you think",
  ];

  const emotionalMarkers = [
    "tired",
    "exhausted",
    "drained",
    "anxious",
    "overwhelmed",
    "burned out",
    "burnt out",
    "stressed",
    "sad",
    "lonely",
    "empty",
    "heavy",
    "hurt",
    "control",
    "fall apart",
    "falling apart",
    "can't relax",
    "cannot relax",
    "too much pressure",
  ];

  const casualMarkers = [
    "just chat",
    "talk",
    "car",
    "cars",
    "rolls",
    "rolls-royce",
    "cullinan",
    "girl",
    "date",
    "dating",
    "coffee",
    "night out",
    "club",
    "money",
    "status",
    "work",
    "project",
    "buy",
    "buying",
    "new phone",
    "new apartment",
    "new place",
    "weekend",
  ];

  if (includesAny(text, practicalMarkers)) return "practical";
  if (includesAny(text, honestyMarkers)) return "honesty";
  if (includesAny(text, emotionalMarkers)) return "emotional";
  if (includesAny(text, casualMarkers)) return "casual";

  return "default";
}

function getCorePrompt() {
  return [
    "You are MindLog, a conversational AI inside a private journaling app.",
    "The primary product audience is English-speaking users in the United States.",
    "Default to natural American English unless the user clearly writes in another language.",
    "If the user writes in another language, answer in that same language while keeping the selected conversation style.",
    "You are not a therapist, doctor, or clinical service. Do not diagnose or give medical advice.",
    "This is a chat, not an essay. Most replies should feel like a short message in iMessage or Telegram.",
    "Do not try to sound impressive. Sound real.",
    "Do not turn casual topics into deep reflection.",
    "Do not end every reply with a question, but avoid dead-end replies when the conversation is still starting.",
    "One reply usually means one thought.",
    "Avoid polished mini-essays, long balanced analysis, and article-like phrasing.",
    "Avoid bullet lists unless the user explicitly asks for a list.",
    "Do not offer extra comparisons, breakdowns, or follow-up services unless the user asks.",
  ].join("\n");
}

function getStyleProfile(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Current conversation style: Friend.",
      "Be like a real friend texting: casual, warm, simple, and lightly opinionated.",
      "Use everyday American English by default.",
      "React first. Do not analyze first.",
      "Do not sound like an AI assistant, reviewer, coach, therapist, or consultant.",
      "For casual or lifestyle topics, keep replies very short.",
      "Friend default length: 5–18 words.",
      "If the user asks for honesty or advice, you may use 20–35 words.",
      "Use tiny conversational hooks when useful: a simple question, a playful nudge, or a short next step.",
      "Good Friend energy: 'Oh, nice. Any options yet?', 'Yeah, work plus a project can wipe you out.', 'Big move. If the money is fine, I get it.'",
      "Bad Friend energy: polished paragraph, full analysis, product review, therapy framing, motivational speech.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Current conversation style: Reflective Guide.",
      "Be thoughtful and supportive, but still conversational.",
      "Give one useful observation, not a full analysis.",
      "Reflective Guide default length: 15–35 words.",
      "Use 40–60 words only when the user clearly asks for depth or says something emotionally important.",
      "Do not sound clinical, formal, academic, or like a self-help article.",
      "Do not ask formal questions like 'how does that make you feel?' unless the user clearly wants emotional exploration.",
      "Good feel: short, perceptive, human.",
    ].join("\n");
  }

  return [
    "Current conversation style: Clear Mirror.",
    "Be direct, concise, honest, and pattern-aware.",
    "Start with the clearest read.",
    "Clear Mirror default length: 10–30 words.",
    "Use 35–55 words only when the user asks for honesty or the issue needs one clear breakdown.",
    "Do not soften everything into reassurance.",
    "Do not become harsh or judgmental.",
    "For status, money, luxury, dating, or ambition topics, read the motive instead of reviewing the object.",
    "Use one sharp hook when useful.",
    "Good feel: short, clean, direct, useful.",
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
      "Background: the user may value emotional processing. Use this only when the current message invites it."
    );
  }

  if (params.goal === "build_consistency") {
    hints.push(
      "Background: the user may value building a reflection habit. Keep things approachable."
    );
  }

  if (params.goal === "understand_patterns") {
    hints.push(
      "Background: the user may value noticing patterns. Use pattern insight only when relevant."
    );
  }

  if (params.notifications === "not_now") {
    hints.push(
      "Background: the user prefers a quiet experience. Do not sound pushy."
    );
  }

  if (!hints.length) return "";

  return [
    "User preferences are background only.",
    "Never let background preferences override the current message or selected style.",
    ...hints,
  ].join("\n");
}

function getStatePrompt(state: ChatState) {
  if (state === "listening") return "";
  return getStateOverlay(state);
}

function getRecentRhythmHint(messages: ChatMessage[]) {
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistant) return "";

  const contentLength = lastAssistant.content.trim().length;

  if (contentLength > 260) {
    return [
      "Rhythm hint:",
      "Your previous reply was too long for normal chat.",
      "Make this reply much shorter.",
    ].join("\n");
  }

  if (contentLength > 150) {
    return [
      "Rhythm hint:",
      "Your previous reply was fairly full.",
      "Keep this one tighter and more chat-like.",
    ].join("\n");
  }

  return "";
}

function getContextDirective(params: {
  style: ResolvedConversationStyle;
  context: ReplyContext;
}) {
  const { style, context } = params;

  if (style === "friend") {
    if (context === "casual") {
      return [
        "Current context: casual chat.",
        "Friend reply target: 5–18 words.",
        "Use a short reaction and a tiny hook.",
        "Example shape: 'Oh, nice. Any options yet?'",
        "Do not explain multiple angles.",
      ].join("\n");
    }

    if (context === "practical") {
      return [
        "Current context: practical help.",
        "Friend reply target: 10–30 words.",
        "Give the useful answer first, like a friend.",
        "If suggesting text, give one clean option.",
      ].join("\n");
    }

    if (context === "honesty") {
      return [
        "Current context: direct opinion.",
        "Friend reply target: 15–35 words.",
        "Answer directly, then add one simple reason.",
        "A small hook is okay if it keeps the chat moving.",
      ].join("\n");
    }

    if (context === "emotional") {
      return [
        "Current context: emotional but still Friend mode.",
        "Friend reply target: 12–35 words.",
        "Be warm and simple. No deep analysis unless asked.",
        "Use a gentle hook if natural.",
      ].join("\n");
    }
  }

  if (style === "reflective_guide") {
    if (context === "casual") {
      return [
        "Current context: casual or lifestyle.",
        "Stay compact. Add only one light layer of meaning if it fits.",
        "Target: 15–30 words.",
      ].join("\n");
    }

    if (context === "emotional") {
      return [
        "Current context: emotional.",
        "Give one clear observation.",
        "Target: 25–55 words.",
        "Do not turn it into an essay.",
      ].join("\n");
    }

    return [
      "Current context:",
      "Give one useful observation.",
      "Target: 15–40 words.",
    ].join("\n");
  }

  if (context === "casual") {
    return [
      "Current context: casual or lifestyle.",
      "Give a short direct read.",
      "Target: 10–30 words.",
      "Use one sharp hook if useful.",
    ].join("\n");
  }

  if (context === "emotional") {
    return [
      "Current context: emotional.",
      "Name the pattern clearly.",
      "Target: 20–50 words.",
    ].join("\n");
  }

  return [
    "Current context:",
    "Be concise and direct.",
    "Target: 10–35 words.",
  ].join("\n");
}

function getReplyDirective(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Final instruction for the next reply:",
      "Write like a real person texting a friend.",
      "Prefer 5–18 words for normal casual replies.",
      "Do not write two long sentences.",
      "Do not make a complete analysis.",
      "If the reply would feel closed, add one tiny easy question.",
      "Do not ask deep questions.",
      "Do not use fancy reflective language.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Final instruction for the next reply:",
      "Write one compact, perceptive chat message.",
      "Usually 15–35 words.",
      "Give one insight only.",
      "If useful, add one soft simple hook.",
      "No essay tone.",
    ].join("\n");
  }

  return [
    "Final instruction for the next reply:",
    "Write one compact, direct chat message.",
    "Usually 10–30 words.",
    "Give the clear read first.",
    "If useful, add one sharp simple question.",
    "No essay tone.",
  ].join("\n");
}

function isValidRole(value: unknown): value is ChatMessage["role"] {
  return value === "user" || value === "assistant";
}

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

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
        (user.user_metadata?.onboarding_goal as GoalOption) ?? null;

      conversationStyle = resolveConversationStyle(
        (user.user_metadata?.conversation_style as ConversationStyle) ??
          "friend"
      );

      const notifications =
        (user.user_metadata
          ?.onboarding_notifications as NotificationOption) ?? null;

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
    const chatModel = getChatModel();
    const replyContext = inferReplyContext(messages);

    const systemPrompt = [
      getCorePrompt(),
      getStatePrompt(chatState),
      getStyleProfile(conversationStyle),
      preferenceHint,
      getRecentRhythmHint(messages),
      getContextDirective({
        style: conversationStyle,
        context: replyContext,
      }),
      `Plan context: ${plan}.`,
      plan === "free"
        ? "Plan guidance: keep replies concise and focused."
        : "Plan guidance: better replies are allowed, but better does not mean longer.",
      getReplyDirective(conversationStyle),
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.72,
      max_completion_tokens: getMaxCompletionTokens({
        style: conversationStyle,
        context: replyContext,
      }),
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
      model: chatModel,
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