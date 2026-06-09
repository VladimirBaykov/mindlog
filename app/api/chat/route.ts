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
  | "plain_greeting"
  | "wellbeing_greeting"
  | "casual"
  | "practical"
  | "writing"
  | "identity"
  | "product"
  | "save_action"
  | "emotional"
  | "honesty"
  | "default";

type SuggestedAction = {
  type: "save_conversation";
  label: string;
  description: string;
};

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
    if (context === "plain_greeting") return 35;
    if (context === "wellbeing_greeting") return 45;
    if (context === "save_action") return 70;
    if (context === "writing") return 180;
    if (context === "identity") return 130;
    if (context === "product") return 160;
    if (context === "emotional") return 90;
    if (context === "practical") return 100;
    return 70;
  }

  if (style === "reflective_guide") {
    if (context === "plain_greeting") return 40;
    if (context === "wellbeing_greeting") return 55;
    if (context === "save_action") return 80;
    if (context === "writing") return 260;
    if (context === "identity") return 150;
    if (context === "product") return 190;
    if (context === "emotional") return 115;
    if (context === "practical") return 120;
    if (context === "honesty") return 110;
    return 90;
  }

  if (context === "plain_greeting") return 35;
  if (context === "wellbeing_greeting") return 45;
  if (context === "save_action") return 70;
  if (context === "writing") return 220;
  if (context === "identity") return 130;
  if (context === "product") return 170;
  if (context === "emotional") return 105;
  if (context === "practical") return 105;
  if (context === "honesty") return 95;
  return 80;
}

function getRetryMaxCompletionTokens(params: {
  style: ResolvedConversationStyle;
  context: ReplyContext;
}) {
  const base = getMaxCompletionTokens(params);

  if (params.context === "writing") return Math.max(base + 120, 340);
  if (params.context === "product") return Math.max(base + 80, 240);
  if (params.context === "identity") return Math.max(base + 60, 180);

  return base + 80;
}

function getLastUserMessage(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user");
}

function getRecentUserMessagesBeforeLast(messages: ChatMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user");
  return userMessages.slice(0, -1).slice(-3);
}

function normalizeForDetection(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function getGreetingContext(text: string): ReplyContext | null {
  const normalized = normalizeForDetection(text);

  if (!normalized) {
    return null;
  }

  const wellbeingGreetings = [
    "how are you",
    "how are u",
    "how's it going",
    "hows it going",
    "how are things",
    "how you doing",
    "how are you doing",
    "how's your day",
    "hows your day",
    "how is your day",
  ];

  const plainGreetings = [
    "hi",
    "hey",
    "hello",
    "yo",
    "sup",
    "what's up",
    "whats up",
    "hi there",
    "hey there",
    "hello there",
  ];

  if (
    wellbeingGreetings.includes(normalized) ||
    (normalized.length <= 90 && includesAny(normalized, wellbeingGreetings))
  ) {
    return "wellbeing_greeting";
  }

  if (plainGreetings.includes(normalized)) {
    return "plain_greeting";
  }

  const isShortPlainGreeting =
    normalized.length <= 28 &&
    (normalized.startsWith("hi ") ||
      normalized.startsWith("hey ") ||
      normalized.startsWith("hello "));

  if (isShortPlainGreeting) {
    return "plain_greeting";
  }

  return null;
}

function looksLikeDraftContent(text: string) {
  const trimmed = text.trim();

  if (trimmed.length < 160) {
    return false;
  }

  const sentenceLikeParts = trimmed
    .split(/[.!?。！？]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const questionMarks = (trimmed.match(/\?/g) || []).length;

  const hasDraftShape =
    trimmed.includes(":") ||
    trimmed.includes("\n") ||
    trimmed.includes('"') ||
    trimmed.includes("“") ||
    trimmed.includes("”") ||
    sentenceLikeParts.length >= 2;

  return hasDraftShape && questionMarks <= 1;
}

function hasRecentDraftContext(messages: ChatMessage[]) {
  return getRecentUserMessagesBeforeLast(messages).some((message) =>
    looksLikeDraftContent(message.content)
  );
}

function isShortFollowUp(text: string) {
  const normalized = normalizeForDetection(text);
  return normalized.length > 0 && normalized.length <= 140;
}

function inferReplyContext(messages: ChatMessage[]): ReplyContext {
  const lastUserMessage = getLastUserMessage(messages);
  const text = lastUserMessage?.content || "";
  const normalized = normalizeForDetection(text);

  if (!normalized) {
    return "default";
  }

  const greetingContext = getGreetingContext(text);

  if (greetingContext) {
    return greetingContext;
  }

  const identityMarkers = [
    "what model",
    "which model",
    "what version",
    "which version",
    "model are you",
    "version are you",
    "are you gpt",
    "gpt 4",
    "gpt4",
    "gpt 5",
    "gpt5",
    "gpt-4",
    "gpt-5",
  ];

  const productMarkers = [
    "what is mindlog",
    "what's mindlog",
    "what is this app",
    "how does mindlog work",
    "what can you do",
    "how do i use mindlog",
    "how do i use this",
    "how do i write notes",
    "how do notes work",
    "how do i save",
    "saved reflection",
    "saved reflections",
    "what is a reflection",
  ];

  const saveActionMarkers = [
    "save this",
    "save it",
    "save this chat",
    "save this conversation",
    "save conversation",
    "save to journal",
    "save this to journal",
    "save this to my journal",
    "save it to journal",
    "save it to my journal",
    "save as journal",
    "save as a journal entry",
    "save this reflection",
    "save reflection",
    "add this to journal",
    "add it to journal",
    "put this in my journal",
    "put it in my journal",
    "journal this",
    "close and save",
  ];

  const writingMarkers = [
    "turn this into",
    "make this into",
    "make it a note",
    "make this a note",
    "make it a journal entry",
    "make this a journal entry",
    "turn it into a journal entry",
    "clean this up",
    "rewrite this",
    "edit this",
    "polish this",
    "fix this text",
    "improve this text",
    "make it better",
    "make it more natural",
    "write this",
    "help me write",
    "continue this",
    "summarize this",
    "shorten this",
    "make it more detailed",
    "add more detail",
    "draft this",
    "format this",
    "note:",
    "text:",
  ];

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

  if (includesAny(normalized, identityMarkers)) return "identity";
  if (includesAny(normalized, productMarkers)) return "product";
  if (includesAny(normalized, saveActionMarkers)) return "save_action";
  if (includesAny(normalized, writingMarkers)) return "writing";
  if (looksLikeDraftContent(text)) return "writing";

  if (hasRecentDraftContext(messages) && isShortFollowUp(text)) {
    return "writing";
  }

  if (includesAny(normalized, practicalMarkers)) return "practical";
  if (includesAny(normalized, honestyMarkers)) return "honesty";
  if (includesAny(normalized, emotionalMarkers)) return "emotional";
  if (includesAny(normalized, casualMarkers)) return "casual";

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
    "Always finish cleanly. Never end mid-sentence. If the full answer would be too long, give a shorter complete answer instead.",
    "Never claim you saved, exported, deleted, opened, changed, updated, or completed an app action unless the app explicitly performed that action.",
    "If the user asks to save the chat, tell them to use the Save to Journal action shown by the app. Do not say the conversation has already been saved.",
    "If the user says only a plain greeting like 'hi', 'hey', or 'hello', do not answer as if they asked how you are.",
    "If the user asks how you are, you may answer briefly and pass it back.",
    "If the user asks which GPT model or exact version you are, do not claim a specific model version. Say you are MindLog, an AI chat inside this app, powered by OpenAI. The exact model may change as the app improves.",
    "If the user asks what MindLog is, explain simply: MindLog is a private reflection chat where users can talk things through, save conversations as journal entries, and later notice patterns, themes, and changes over time.",
    "If the user asks how notes or journal entries work, explain that they can write naturally, even messy, and MindLog can help clean it up, shape it into a journal entry, continue it, or save the conversation when they close it.",
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
      "Be thoughtful and supportive, but still conversational and normal.",
      "The user may simply want to talk in a thoughtful style; do not assume they are worried, distressed, or asking for emotional support.",
      "For greetings and small talk, answer simply and naturally. Do not open like a support agent or therapy session.",
      "Do not sound like a therapy room, meditation app, or emotional support hotline.",
      "Avoid presence phrases like 'I am here and steady', 'calm and here', 'ready to help', 'here and paying attention', 'holding space', or 'what is on your mind today' unless the user clearly needs grounding.",
      "Give one useful observation, not a full analysis.",
      "Reflective Guide default length: 12–28 words.",
      "Use 35–50 words only when the user clearly asks for depth or says something emotionally important.",
      "Do not sound clinical, formal, academic, or like a self-help article.",
      "Do not ask formal questions like 'how does that make you feel?' unless the user clearly wants emotional exploration.",
      "For casual topics, be only slightly deeper than Friend, not dramatically more reflective.",
      "Good feel: compact, perceptive, human, quietly useful.",
      "Bad feel: therapy opening, polished insight paragraph, formal emotional question, motivational speech.",
    ].join("\n");
  }

  return [
    "Current conversation style: Clear Mirror.",
    "Be direct, concise, honest, and pattern-aware.",
    "Start with the clearest read.",
    "Do not lead with emotional support, soothing language, or soft reassurance.",
    "Avoid soft openings like 'calm and here', 'I am here', or 'that sounds hard' unless the user is clearly distressed.",
    "Use 'probably', 'yes', 'not really', or 'that sounds like' when the evidence is strong. Do not hide behind 'maybe' too often.",
    "Clear Mirror default length: 8–24 words.",
    "Use 28–45 words only when the user asks for honesty or the issue needs one clear breakdown.",
    "Do not soften everything into reassurance.",
    "Do not become harsh or judgmental.",
    "For status, money, luxury, dating, or ambition topics, read the motive instead of reviewing the object.",
    "Use one sharp hook when useful.",
    "Good feel: short, clean, direct, useful, a little uncomfortable.",
    "Bad feel: supportive cushioning, gentle reassurance first, therapy voice, long explanation.",
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

  if (context === "plain_greeting") {
    return [
      "Current context: plain greeting.",
      "The user only greeted you. Do not answer as if they asked how you are.",
      "Reply naturally and briefly.",
      style === "friend"
        ? "Friend target: 1–8 words. Example shape: 'Hey.' or 'Hey — what’s up?'"
        : style === "reflective_guide"
        ? "Reflective Guide target: 2–10 words. Example shape: 'Hey. How’s your day going?'"
        : "Clear Mirror target: 1–8 words. Example shape: 'Hey. What’s up?'",
    ].join("\n");
  }

  if (context === "wellbeing_greeting") {
    return [
      "Current context: wellbeing greeting.",
      "The user is asking how you are.",
      "Answer briefly, then pass it back.",
      style === "friend"
        ? "Friend target: 5–12 words. Example shape: 'Hey, I’m good. You?'"
        : style === "reflective_guide"
        ? "Reflective Guide target: 5–14 words. Example shape: 'I’m doing well. How are you?'"
        : "Clear Mirror target: 3–10 words. Example shape: 'I’m good. What’s up?'",
    ].join("\n");
  }

  if (context === "save_action") {
    return [
      "Current context: the user wants to save the conversation.",
      "Do not say the conversation has already been saved.",
      "Tell the user to tap the Save to Journal action shown by the app.",
      "Keep the reply short and natural.",
      "Target: 8–24 words.",
    ].join("\n");
  }

  if (context === "writing") {
    return [
      "Current context: writing, editing, rewriting, or shaping a note.",
      "Complete the requested text cleanly.",
      "It is okay to be longer than normal chat for this specific task.",
      "Do not end mid-sentence.",
      "Do not add a trailing 'if you want, I can...' sentence when the main written piece is already complete.",
      "If the user asked for a note or journal entry, provide the finished note directly.",
      style === "friend"
        ? "Friend writing target: usually 50–120 words."
        : style === "reflective_guide"
        ? "Reflective Guide writing target: usually 60–150 words."
        : "Clear Mirror writing target: usually 45–110 words.",
    ].join("\n");
  }

  if (context === "identity") {
    return [
      "Current context: identity or model question.",
      "Do not claim a specific GPT model or version.",
      "Say you are MindLog, an AI chat inside this app, powered by OpenAI.",
      "If useful, say the exact model can change as the app improves.",
      "Keep it brief and natural.",
      "Target: 15–40 words.",
    ].join("\n");
  }

  if (context === "product") {
    return [
      "Current context: product explanation or app help.",
      "Explain MindLog simply and practically.",
      "Mention that users can chat, reflect, save conversations as journal entries, and later notice patterns.",
      "If the user asks how to write notes, explain that they can write naturally and MindLog can clean up, continue, or shape the text.",
      "Keep it useful but not salesy.",
      "Target: 35–80 words.",
    ].join("\n");
  }

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
        "Friend reply target: 10–35 words.",
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
        "Stay compact and normal.",
        "Add only one light layer of meaning if it genuinely fits.",
        "Do not open like a therapist.",
        "Target: 12–25 words.",
      ].join("\n");
    }

    if (context === "practical") {
      return [
        "Current context: practical help.",
        "Give one useful answer or one useful observation.",
        "Stay practical first, reflective second.",
        "Target: 15–40 words.",
      ].join("\n");
    }

    if (context === "honesty") {
      return [
        "Current context: honesty or direct opinion.",
        "Give a clear read, then one thoughtful condition.",
        "Do not hedge too much.",
        "Target: 18–38 words.",
      ].join("\n");
    }

    if (context === "emotional") {
      return [
        "Current context: emotional.",
        "Give one clear observation that helps the user understand what is happening.",
        "Do not make it a therapy monologue.",
        "Use one soft simple hook if useful.",
        "Target: 20–45 words.",
      ].join("\n");
    }

    return [
      "Current context:",
      "Give one useful observation.",
      "Keep it compact and chat-like.",
      "Target: 12–32 words.",
    ].join("\n");
  }

  if (style === "clear_mirror") {
    if (context === "casual") {
      return [
        "Current context: casual or lifestyle.",
        "Give a short direct read.",
        "Do not add supportive cushioning.",
        "Target: 8–24 words.",
        "Use one sharp hook if useful.",
      ].join("\n");
    }

    if (context === "practical") {
      return [
        "Current context: practical help.",
        "Give the direct move first.",
        "Do not over-explain.",
        "Target: 10–32 words.",
      ].join("\n");
    }

    if (context === "honesty") {
      return [
        "Current context: honesty or direct opinion.",
        "Answer clearly in the first sentence.",
        "Use 'probably', 'yes', 'no', or 'not really' when appropriate.",
        "Then add one sharp reason.",
        "Target: 14–36 words.",
      ].join("\n");
    }

    if (context === "emotional") {
      return [
        "Current context: emotional.",
        "Name the pattern clearly.",
        "Do not lead with comfort.",
        "One direct observation is enough.",
        "Target: 16–40 words.",
      ].join("\n");
    }

    return [
      "Current context:",
      "Be concise and direct.",
      "No supportive cushioning.",
      "Target: 8–30 words.",
    ].join("\n");
  }

  return "";
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
      "If the user only said hi, hey, or hello, do not say you are good unless they asked how you are.",
      "If the reply would feel closed, add one tiny easy question.",
      "Do not ask deep questions.",
      "Do not use fancy reflective language.",
      "For writing or editing tasks, complete the requested text cleanly even if it is longer than normal chat.",
      "Never end mid-sentence.",
      "Never claim an app action is completed unless the app actually completed it.",
    ].join("\n");
  }

  if (resolvedStyle === "reflective_guide") {
    return [
      "Final instruction for the next reply:",
      "Write one compact, perceptive chat message.",
      "Usually 12–30 words.",
      "Give one insight only.",
      "If this is a plain greeting, reply simply and do not say you are doing well unless asked.",
      "If this is a wellbeing greeting, answer briefly and pass it back.",
      "Do not sound like a therapist opening a session.",
      "No grounding/presence language unless the user is distressed.",
      "Avoid phrases like 'here and paying attention' in greetings.",
      "If useful, add one soft simple hook.",
      "For writing or editing tasks, complete the requested note or text cleanly even if it is longer than normal chat.",
      "Never end mid-sentence.",
      "Never claim an app action is completed unless the app actually completed it.",
      "No essay tone.",
    ].join("\n");
  }

  return [
    "Final instruction for the next reply:",
    "Write one compact, direct chat message.",
    "Usually 8–28 words.",
    "Give the clear read first.",
    "If the user only said hi, hey, or hello, do not say you are good unless they asked how you are.",
    "Do not start with comfort or validation unless safety requires it.",
    "Use a sharp simple question only if it moves the conversation forward.",
    "For writing or editing tasks, complete the requested text cleanly even if it is longer than normal chat.",
    "Never end mid-sentence.",
    "Never claim an app action is completed unless the app actually completed it.",
    "No essay tone.",
  ].join("\n");
}

function getRetryDirective() {
  return [
    "Retry instruction:",
    "The previous draft would be too long or incomplete.",
    "Answer again as a shorter complete response.",
    "Do not mention truncation, tokens, or retrying.",
    "Never end mid-sentence.",
    "If this is a writing task, provide one complete shorter version instead of a long unfinished one.",
  ].join("\n");
}

function getSaveConversationAction(): SuggestedAction {
  return {
    type: "save_conversation",
    label: "Save to Journal",
    description: "Save this conversation as a journal entry.",
  };
}

function getSaveActionReply(style: ResolvedConversationStyle) {
  if (style === "clear_mirror") {
    return "Tap Save to Journal below and I’ll save it.";
  }

  if (style === "reflective_guide") {
    return "Yes — tap Save to Journal below and I’ll save this conversation.";
  }

  return "Yep — tap Save to Journal below and I’ll save it.";
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

    if (replyContext === "save_action") {
      return NextResponse.json({
        reply: getSaveActionReply(conversationStyle),
        chatState,
        model: chatModel,
        suggestedAction: getSaveConversationAction(),
      });
    }

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

    const completionMaxTokens = getMaxCompletionTokens({
      style: conversationStyle,
      context: replyContext,
    });

    let completion = await openai.chat.completions.create({
      model: chatModel,
      temperature: 0.72,
      max_completion_tokens: completionMaxTokens,
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

    if (completion.choices[0]?.finish_reason === "length") {
      completion = await openai.chat.completions.create({
        model: chatModel,
        temperature: 0.58,
        max_completion_tokens: getRetryMaxCompletionTokens({
          style: conversationStyle,
          context: replyContext,
        }),
        messages: [
          {
            role: "system",
            content: [systemPrompt, getRetryDirective()]
              .filter(Boolean)
              .join("\n\n"),
          },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      });
    }

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