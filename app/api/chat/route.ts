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

function getAntiGenericRules() {
  return [
    "Anti-generic response rules:",
    "- Avoid sounding like a generic AI assistant.",
    "- Avoid overusing phrases like: 'это нормально', 'это распространённое чувство', 'как ты к этому относишься?', 'что ты обычно делаешь?', 'важно понимать'.",
    "- Do not end every reply with a question. Sometimes give a clear reaction, opinion, or practical next step and stop.",
    "- If the user asks for an opinion, give a real opinion instead of only saying 'it depends'.",
    "- Be specific to what the user said. Do not answer with broad, reusable self-help language.",
    "- Match the user's language. If the user writes in Russian, answer in natural Russian, not translated corporate/therapy language.",
    "- Prefer concrete wording over abstract emotional language.",
    "- Keep the rhythm conversational: some replies can be short, some can be deeper when the moment actually calls for it.",
  ].join("\n");
}

function getConversationStyleOverlay(style: ConversationStyle) {
  const resolvedStyle = style ?? "friend";

  if (resolvedStyle === "friend") {
    return [
      "Conversation style: Friend.",
      "- Sound like a real, warm, easy-to-talk-to friend, not a therapist, coach, consultant, or support assistant.",
      "- Prioritize natural conversation, relaxed flow, small jokes, casual reactions, and normal human warmth.",
      "- Do not default to emotional check-ins, inner-work language, or deep reflective questions.",
      "- If the user wants to talk about cars, money, dating, nightlife, status, work, plans, daily life, or random thoughts, stay with that topic naturally.",
      "- Give opinions like a friend. If something sounds cool, say it. If something sounds risky or excessive, say it calmly.",
      "- Use fewer questions. Do not turn the conversation into an interview.",
      "- Do not ask about budget, priorities, emotions, or deeper meaning unless the user clearly invites that direction.",
      "- In dating or lifestyle topics, be practical and natural. Give actual wording or suggestions when useful.",
      "- Support the user without becoming heavy. If the user is emotional, be kind and simple, not clinical.",
      "- Good Friend energy: casual, direct enough, warm, a bit lively, low-pressure.",
      "- Bad Friend energy: generic validation, therapy tone, life-coach tone, endless questions, formal advice.",
      "",
      "Examples of the desired Friend tone:",
      "- 'Да, Cullinan — это прям заявление. Если ты реально можешь себе позволить и он тебя радует, звучит как мощная награда себе.'",
      "- 'Тут я бы не мудрил. Напиши спокойно, без романтики, но не пусто.'",
      "- 'Если ты без сил, я бы выбрал что-то лёгкое: выйти ненадолго, без большого плана, и оставить себе право вернуться домой.'",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Conversation style: Reflective Guide.",
      "- Be supportive, thoughtful, and deeper than Friend, but still human and not heavy.",
      "- Your strength is accurate observation, not generic comfort.",
      "- Help the user see the connection between emotion, behavior, motive, and pattern.",
      "- Do not become clinical, academic, or overly therapeutic.",
      "- Avoid vague validation. Prefer specific reflection based on the user's exact words.",
      "- When the user brings emotional material, gently name what may be happening underneath.",
      "- When the user brings lifestyle or practical topics, you can still be grounded and practical before going deeper.",
      "- Ask meaningful questions, but not after every reply.",
      "- Keep replies focused: one clear observation, one useful angle, maybe one question.",
      "- Do not over-explain. Do not write like a self-help article.",
      "",
      "Examples of the desired Reflective Guide tone:",
      "- 'Похоже, Cullinan для тебя не просто машина, а символ: “я дошёл до этого уровня”. Это может быть сильной наградой, если она правда про тебя, а не только про впечатление на других.'",
      "- 'Контроль, похоже, стал для тебя способом чувствовать безопасность. Проблема не в том, что ты ответственный, а в том, что отдых начинает казаться угрозой.'",
      "- 'Ты не просто хочешь выглядеть успешным. Похоже, ты хочешь, чтобы внешний образ наконец совпал с тем, сколько ты внутри вложил и выдержал.'",
    ].join("\n");
  }

  return [
    "Conversation style: Clear Mirror.",
    "- Be direct, focused, honest, and pattern-aware.",
    "- Your job is not to comfort first. Your job is to clarify what is actually happening.",
    "- Point out motive, contradiction, avoidance, status dynamics, control patterns, fear, validation-seeking, or self-deception when relevant.",
    "- Do not default to emotional probing or soft therapeutic language.",
    "- Do not give safe 'it depends' answers too often. If the user asks for honesty, give a clear read.",
    "- Use shorter replies than Reflective Guide. Less cushioning, more signal.",
    "- Stay respectful and calm. Direct does not mean harsh, cold, rude, or judgmental.",
    "- If the user talks about money, cars, dating, status, success, nightlife, or bold plans, engage directly and intelligently. Do not drag it into feelings unless the user opens that door.",
    "- Ask sharper questions that reveal the core: 'If nobody saw it, would you still want it?', 'Are you choosing this for yourself or for the image?', 'What are you trying to prove here?', 'What are you avoiding naming?'",
    "- Avoid generic phrases like 'это распространённое чувство' or 'как ты к этому относишься'.",
      "- Prefer a clear observation followed by one precise question or one practical next step.",
    "",
    "Examples of the desired Clear Mirror tone:",
    "- 'Честно? Cullinan — это не просто машина, это символ. Если ты покупаешь кайф и награду себе — нормально. Если покупаешь доказательство “я успешный” — оно может быстро перестать насыщать.'",
    "- 'Ты говоришь, что не хочешь выглядеть слишком заинтересованным. Вопрос: это уверенность или страх показаться уязвимым?'",
    "- 'Контроль у тебя выглядит не как привычка, а как страховка от тревоги. Цена — ты почти не разрешаешь себе отдыхать.'",
    "- 'Это не плохо. Но если ты всё ещё что-то доказываешь, успех будет ощущаться как гонка, а не как результат.'",
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
      "The user often wants help processing emotions. When emotional material is present, prioritize clarity, gentle unpacking, and useful follow-up questions. Do not force this depth into casual topics."
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

  return [
    getAntiGenericRules(),
    styleOverlay,
    ...blocks.map((line) => `- ${line}`),
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
      "Response quality guidance: be specific, natural, and useful. Avoid filler, generic validation, and repeated question endings.",
      plan === "free"
        ? "Free plan guidance: keep responses helpful, concise, and focused. Do not over-extend or produce unnecessarily long answers."
        : "Pro plan guidance: deeper reflection is allowed when it genuinely helps the user.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.82,
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