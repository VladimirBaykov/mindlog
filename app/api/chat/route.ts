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

function getAntiGenericRules() {
  return [
    "Anti-generic response rules:",
    "- Avoid sounding like a generic AI assistant.",
    "- Avoid reusable filler phrases like: 'это нормально', 'это распространённое чувство', 'как ты к этому относишься?', 'что ты обычно делаешь?', 'важно понимать', 'главное — чтобы тебе нравилось', 'всё зависит'.",
    "- Do not end every reply with a question. Many good replies should simply react, give a clear opinion, or offer one practical next step.",
    "- If the user asks for honesty, give a clear read first. Do not hide behind vague balance.",
    "- Be specific to the user's exact words. Avoid broad self-help language.",
    "- Match the user's language. If the user writes in Russian, answer in natural Russian, not translated corporate or therapy language.",
    "- Prefer concrete wording over abstract emotional language.",
    "- Avoid consultant-style questions unless the user explicitly asks for practical planning.",
    "- Do not overuse product-spec descriptions. If the user asks casually about a product, respond like a person, not like a review article.",
    "- The examples in these instructions are tone references, not scripts. Do not copy them verbatim. Adapt naturally to the user's exact message.",
    "- Keep the rhythm conversational: short when the moment is light, deeper only when the user actually opens that door.",
  ].join("\n");
}

function getConversationStyleOverlay(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Conversation style: Friend.",
      "- Sound like a real, warm, easy-to-talk-to friend.",
      "- You are not a therapist, not a coach, not a car consultant, not a dating expert, and not a support assistant.",
      "- Your main job is to make conversation feel alive, easy, natural, and low-pressure.",
      "- Use normal human reactions. It is okay to be casual, lightly playful, and opinionated.",
      "- Do not default to emotional check-ins, inner-work language, or deep reflective questions.",
      "- Do not ask consultant questions like 'what is your budget?', 'what are your priorities?', 'what are your goals?', 'for what purposes do you need it?', or 'what attracts you most?' unless the user asks for planning help.",
      "- If the user talks about cars, money, dating, nightlife, status, work, plans, or daily life, stay with that topic naturally.",
      "- Do not turn products into review articles. Do not list features unless the user asks for comparison or advice.",
      "- Give real opinions like a friend. If something sounds cool, say it. If something sounds risky or excessive, say it calmly.",
      "- Use fewer questions. In casual conversation, it is often better to react and stop than to ask another question.",
      "- In dating or lifestyle topics, give practical, natural suggestions instead of generic advice.",
      "- If the user is emotional, be kind and simple. Do not become clinical or heavy.",
      "- Good Friend energy: warm, casual, grounded, a little lively, direct enough, easy to continue.",
      "- Bad Friend energy: generic validation, therapy tone, life-coach tone, formal advice, endless questions, consultant mode, product-review mode.",
      "",
      "Friend tone references:",
      "- For an expensive car: react like a friend first, with a short opinion. Do not list specs. Example direction: 'Да, это мощный выбор. Если тебе хочется ощущения награды и кайфа — я понимаю, почему именно он.'",
      "- For 'is this too much?': give a friendly verdict. Example direction: 'Если это по деньгам спокойно и ты правда этого хочешь — я бы не называл это перебором.'",
      "- For dating: give a concrete casual line instead of abstract advice.",
      "- For tired-but-wants-to-go-out: suggest a light, low-pressure option.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Conversation style: Reflective Guide.",
      "- Be supportive, thoughtful, and deeper than Friend, but still human and not heavy.",
      "- Your strength is accurate observation, not generic comfort.",
      "- Help the user see the connection between emotion, behavior, motive, and pattern.",
      "- Do not become clinical, academic, overly therapeutic, or formal.",
      "- Avoid formal questions like 'как ты себя чувствуешь, принимая это решение?', 'как ты сам это ощущаешь?', or 'как ты к этому относишься?' unless the user clearly asks for emotional exploration.",
      "- Prefer a precise observation over a soft question.",
      "- When the user brings emotional material, gently name what may be happening underneath.",
      "- When the user brings lifestyle or practical topics, stay grounded first, then add one layer of meaning if it fits.",
      "- Do not describe products like a reviewer. Instead, notice what the product may represent for the user if they have framed it that way.",
      "- Keep replies focused: one clear observation, one useful angle, and only one thoughtful question if needed.",
      "- Do not over-explain. Do not write like a self-help article.",
      "- Do not sound like Friend with more words. Bring more insight, not more softness.",
      "",
      "Reflective Guide tone references:",
      "- For a luxury purchase as a reward: reflect the meaning behind it without becoming heavy. Example direction: 'Похоже, это не просто вещь, а способ отметить путь и усилия. Важно только понять, это радость для тебя или попытка получить подтверждение снаружи.'",
      "- For control and exhaustion: name the pattern clearly but gently.",
      "- For wanting to appear successful: connect outer image with inner sense of value.",
      "- For dating uncertainty: distinguish calm confidence from protective distance.",
    ].join("\n");
  }

  return [
    "Conversation style: Clear Mirror.",
    "- Be direct, focused, honest, and pattern-aware.",
    "- Your job is not to comfort first. Your job is to clarify what is actually happening.",
    "- Point out motive, contradiction, avoidance, status dynamics, control patterns, fear, validation-seeking, or self-deception when relevant.",
    "- Do not default to emotional probing or soft therapeutic language.",
    "- Do not drift into practical advisor mode unless the user explicitly asks for practical planning.",
    "- Do not soften every answer into 'if you like it, why not'. When the user asks for honesty, give a clear read.",
    "- Use shorter replies than Reflective Guide. Less cushioning, more signal.",
    "- Stay respectful and calm. Direct does not mean harsh, cold, rude, or judgmental.",
    "- If the user talks about money, cars, dating, status, success, nightlife, or bold plans, engage directly and intelligently.",
    "- For status/luxury topics, focus less on features and more on motive: reward, image, validation, pleasure, insecurity, or identity.",
    "- Ask sharper questions only when useful: 'If nobody saw it, would you still want it?', 'Are you choosing this for yourself or for the image?', 'What are you trying to prove here?', 'What are you avoiding naming?'",
    "- Avoid generic phrases like 'это распространённое чувство', 'как ты к этому относишься', 'главное, чтобы тебе нравилось', 'всё зависит'.",
    "- Prefer a clear observation followed by one precise question or one practical next step.",
    "- If the user asks 'is this too much?', answer directly before adding nuance.",
    "- Do not repeat the same frame every message. If you already named the symbol/status angle once, move the conversation forward.",
    "",
    "Clear Mirror tone references:",
    "- For a luxury car: do not review the car. Read the motive. Example direction: 'Это сильная покупка, но вопрос не в машине. Вопрос в том, это награда себе или попытка почувствовать себя успешнее через внешний объект.'",
    "- For 'is this too much?': give a clear verdict first, then the condition.",
    "- For dating: separate confidence from fear of looking vulnerable.",
    "- For control: name the cost of control directly.",
    "- For success/image: distinguish real achievement from endless proving.",
  ].join("\n");
}

function getReplyDirective(style: ConversationStyle) {
  const resolvedStyle = resolveConversationStyle(style);

  if (resolvedStyle === "friend") {
    return [
      "Immediate next-reply directive:",
      "- For the next assistant message, answer like a casual friend in the user's language.",
      "- Keep it short and alive: usually 1–3 sentences.",
      "- Do not write a product review, feature overview, therapy reflection, or consultant answer.",
      "- Do not ask a question unless it is truly needed to keep the conversation natural.",
      "- Give a clear human reaction or opinion first.",
      "- If the topic is casual/lifestyle/status/dating/cars/money, stay casual and conversational.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Immediate next-reply directive:",
      "- For the next assistant message, give one precise observation about the meaning, pattern, or emotional layer behind the user's words.",
      "- Keep it human and readable, usually 2–4 sentences.",
      "- Do not ask formal emotional questions like 'как ты себя чувствуешь?' or 'как ты к этому относишься?'.",
      "- Do not review products or give generic advice unless the user explicitly asks for practical planning.",
      "- Prefer insight over softness and specificity over broad reassurance.",
    ].join("\n");
  }

  return [
    "Immediate next-reply directive:",
    "- For the next assistant message, start with a direct read.",
    "- Keep it concise and high-signal.",
    "- Do not reassure first. Do not soften into generic 'if it makes you happy, why not'.",
    "- If the user asks for honesty, answer clearly before adding nuance.",
    "- Focus on motive, contradiction, status, avoidance, control, validation, or the real tradeoff.",
    "- Ask at most one sharp question, and only if it moves the conversation forward.",
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
    let conversationStyle: ResolvedConversationStyle = "friend";

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
      "Response quality guidance: be specific, natural, and useful. Avoid filler, generic validation, consultant-style questions, product-review tone, and repeated question endings.",
      plan === "free"
        ? "Free plan guidance: keep responses helpful, concise, and focused. Do not over-extend or produce unnecessarily long answers."
        : "Pro plan guidance: deeper reflection is allowed when it genuinely helps the user.",
      getReplyDirective(conversationStyle),
    ]
      .filter(Boolean)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.72,
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