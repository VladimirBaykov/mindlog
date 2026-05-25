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

function getMaxCompletionTokens(style: ResolvedConversationStyle) {
  if (style === "friend") {
    return 115;
  }

  if (style === "reflective_guide") {
    return 155;
  }

  return 135;
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

  const honestyMarkers = [
    "честно",
    "по честному",
    "скажи прямо",
    "как думаешь",
    "реально",
    "перебор",
    "правда",
  ];

  const practicalMarkers = [
    "что написать",
    "как написать",
    "как лучше",
    "что делать",
    "что выбрать",
    "дай вариант",
    "предложи",
    "совет",
    "помоги написать",
  ];

  const emotionalMarkers = [
    "устал",
    "тяжело",
    "внутри",
    "контрол",
    "страшно",
    "тревож",
    "выгора",
    "не могу",
    "развал",
    "держу",
    "больно",
    "одиноко",
  ];

  const casualMarkers = [
    "поболтать",
    "машин",
    "тачк",
    "rolls",
    "ролс",
    "cullinan",
    "девуш",
    "кофе",
    "вечер",
    "купить",
    "деньги",
    "статус",
    "ночь",
    "клуб",
    "работу",
  ];

  if (includesAny(text, practicalMarkers)) {
    return "practical";
  }

  if (includesAny(text, honestyMarkers)) {
    return "honesty";
  }

  if (includesAny(text, emotionalMarkers)) {
    return "emotional";
  }

  if (includesAny(text, casualMarkers)) {
    return "casual";
  }

  return "default";
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
    "Use chat rhythm, not essay rhythm.",
    "Most replies should feel like a message someone would actually send in a chat.",
    "Usually answer in 1–2 sentences. Use 3–4 sentences only when the user's message genuinely needs more depth.",
    "Vary reply length naturally. Do not make every answer the same size.",
    "One reply should usually contain one main thought, not a complete analysis of every angle.",
    "Do not try to perfectly close every topic. Keep the conversation alive.",
    "Avoid poetic, overly finished, or article-like phrasing in normal chat.",
    "Use one compact paragraph by default.",
    "Do not use bullet lists unless the user explicitly asks for a list or comparison.",
    "Do not offer extra comparisons, breakdowns, or follow-up services unless the user asks.",
    "Depth should come from precision, not length.",
  ].join("\n");
}

function getStyleProfile(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Current conversation style: Friend.",
      "Be a real friend in a messenger chat: warm, casual, alive, lightly opinionated.",
      "React first. Do not analyze first.",
      "Do not sound like a consultant, reviewer, coach, therapist, or journal app.",
      "Use simple, everyday language.",
      "For lifestyle topics like cars, dating, money, status, nightlife, work, or plans, keep it natural and conversational.",
      "Do not list product features unless the user asks for comparison or details.",
      "Do not use big reflective words like 'symbol', 'inner meaning', 'stage', or 'status' too often. Use them only if the user clearly goes there.",
      "Use fewer questions. Often answer with a clear reaction and stop.",
      "Usual length: 1 short message. Sometimes 2–3 sentences if the user asks for honesty or advice.",
      "Good Friend feel: 'О, мощно', 'я бы понял', 'если по деньгам спокойно — почему нет', 'это прям вау-подарок себе'.",
      "Bad Friend feel: polished paragraph, review tone, balanced essay, therapy framing, endless questions.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Current conversation style: Reflective Guide.",
      "Be thoughtful and a little deeper, but still like a human in a chat.",
      "Give one precise observation about meaning, motive, emotion, or pattern.",
      "Do not sound clinical, academic, formal, or like a self-help article.",
      "Prefer one useful insight over a full explanation.",
      "Do not ask formal questions like 'как ты себя чувствуешь?' or 'как ты к этому относишься?'.",
      "For practical or lifestyle topics, stay grounded first, then add one layer of meaning only if it fits.",
      "Usual length: 1–3 sentences.",
      "Use 4 sentences only when the user clearly opens a deeper topic or asks what to do.",
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
    "Use sharp but short wording.",
    "Ask at most one sharp question only if it moves the conversation forward.",
    "Usual length: 1–3 sentences.",
    "Use 4 sentences only when the user's message needs a clearer breakdown.",
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

function getRecentRhythmHint(messages: ChatMessage[]) {
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistant) {
    return "";
  }

  const contentLength = lastAssistant.content.trim().length;

  if (contentLength > 520) {
    return [
      "Rhythm hint:",
      "Your previous assistant reply was long. Make the next reply noticeably shorter unless the user explicitly asks for depth.",
    ].join("\n");
  }

  if (contentLength > 300) {
    return [
      "Rhythm hint:",
      "Your previous assistant reply was fairly full. Avoid another equally polished paragraph. Keep the next reply tighter if possible.",
    ].join("\n");
  }

  return "";
}

function getContextRhythmHint(params: {
  style: ResolvedConversationStyle;
  context: ReplyContext;
}) {
  const { style, context } = params;

  if (context === "casual") {
    if (style === "friend") {
      return [
        "Current message context: casual / lifestyle.",
        "Reply like a real chat message.",
        "Use one short reaction plus one simple opinion.",
        "Do not produce a complete analysis.",
        "Do not make it sound smart for the sake of sounding smart.",
      ].join("\n");
    }

    if (style === "reflective_guide") {
      return [
        "Current message context: casual / lifestyle.",
        "Stay compact. Add only one light layer of meaning if it genuinely fits.",
        "Do not turn this into a deep reflection.",
      ].join("\n");
    }

    return [
      "Current message context: casual / lifestyle.",
      "Give a short direct read of the motive or tradeoff.",
      "Do not over-explain.",
    ].join("\n");
  }

  if (context === "practical") {
    return [
      "Current message context: practical help.",
      "Give the useful answer directly.",
      "If the user asks what to write or do, provide a concrete option first.",
      "Do not over-explain the psychology behind it unless asked.",
    ].join("\n");
  }

  if (context === "honesty") {
    return [
      "Current message context: honesty / direct opinion.",
      "Answer directly in the first sentence.",
      "Then add only one short reason or condition.",
      "Avoid balanced essay structure.",
    ].join("\n");
  }

  if (context === "emotional") {
    return [
      "Current message context: emotional / personal.",
      "You may go a little deeper, but keep it conversational.",
      "One clear observation is better than a long supportive paragraph.",
    ].join("\n");
  }

  return "";
}

function getReplyDirective(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Next reply directive:",
      "Answer like a casual friend texting.",
      "Usually use 1–2 sentences.",
      "You may use 3 sentences if the user asks for honesty, advice, or a fuller take.",
      "No product review. No consultant questions. No therapy framing.",
      "No bullet lists.",
      "Give a clear human reaction or opinion first.",
      "Do not ask a question unless it feels truly natural.",
      "Do not offer extra comparisons or breakdowns.",
      "Make it feel like a real chat message, not a polished paragraph.",
      "It is okay to be simple. Do not make every reply profound.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Next reply directive:",
      "Give one useful observation about the meaning behind the user's words.",
      "Usually use 1–3 sentences.",
      "You may use 4 sentences only if the user clearly asks for depth or practical help.",
      "Do not ask formal emotional questions.",
      "Do not review products.",
      "No bullet lists.",
      "Make the user feel understood through specificity, not length.",
      "Do not offer extra comparisons or breakdowns.",
      "Avoid sounding too polished or essay-like.",
    ].join("\n");
  }

  return [
    "Next reply directive:",
    "Start with a direct read.",
    "Usually use 1–3 concise, high-signal sentences.",
    "You may use 4 sentences only when the user's message needs a sharper breakdown.",
    "Do not reassure first.",
    "Do not say 'it depends' unless absolutely necessary.",
    "Name the motive or tradeoff clearly.",
    "No bullet lists.",
    "Do not offer extra comparisons or breakdowns.",
    "Ask at most one sharp question.",
    "Avoid sounding too polished or essay-like.",
  ].join("\n");
}

function isValidRole(value: unknown): value is ChatMessage["role"] {
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
      getContextRhythmHint({
        style: conversationStyle,
        context: replyContext,
      }),
      `Plan context: ${plan}.`,
      plan === "free"
        ? "Plan guidance: keep replies concise and focused."
        : "Plan guidance: deeper replies are allowed when genuinely useful, but deeper does not mean longer.",
      getReplyDirective(conversationStyle),
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.68,
      max_completion_tokens: getMaxCompletionTokens(conversationStyle),
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