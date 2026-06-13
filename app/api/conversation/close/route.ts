import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolveUserSubscription } from "@/lib/billing";
import { getJournalLimit } from "@/lib/plans";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Mood =
  | "calm"
  | "reflective"
  | "heavy"
  | "anxious"
  | "hopeful"
  | "happy"
  | "sad"
  | "excited"
  | "confused"
  | "casual";

type ReflectionMetadata = {
  summary: string;
  keyTakeaway: string;
  themes: string[];
  chatType:
    | "personal_reflection"
    | "emotional_check_in"
    | "relationship_reflection"
    | "decision_moment"
    | "work_reflection"
    | "casual_conversation"
    | "planning";
};

type JournalMetadata = {
  title: string;
  mood: Mood;
  reflection: ReflectionMetadata;
};

const ALLOWED_MOODS: Mood[] = [
  "calm",
  "reflective",
  "heavy",
  "anxious",
  "hopeful",
  "happy",
  "sad",
  "excited",
  "confused",
  "casual",
];

const ALLOWED_CHAT_TYPES: ReflectionMetadata["chatType"][] = [
  "personal_reflection",
  "emotional_check_in",
  "relationship_reflection",
  "decision_moment",
  "work_reflection",
  "casual_conversation",
  "planning",
];

function getJournalModel() {
  return (
    process.env.OPENAI_JOURNAL_MODEL ||
    process.env.OPENAI_CHAT_MODEL ||
    "gpt-4o-mini"
  );
}

function normalizeText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeForDetection(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowSignalUserMessage(content: string) {
  const normalized = normalizeForDetection(content);

  if (!normalized) return true;

  const exactLowSignal = [
    "hi",
    "hey",
    "hello",
    "yo",
    "sup",
    "thanks",
    "thank you",
    "ok",
    "okay",
    "cool",
    "nice",
    "save it",
    "save this",
    "save this chat",
    "save this conversation",
    "save to journal",
    "can you save this",
    "can you save this chat",
    "can you save this conversation",
  ];

  if (exactLowSignal.includes(normalized)) {
    return true;
  }

  if (normalized.length <= 12) {
    return true;
  }

  if (
    normalized.startsWith("save ") ||
    normalized.includes(" save this") ||
    normalized.includes(" save it") ||
    normalized.includes("save to journal")
  ) {
    return true;
  }

  return false;
}

function getMeaningfulUserMessages(messages: Message[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => normalizeText(message.content))
    .filter((content) => !isLowSignalUserMessage(content));
}

function createFallbackTitle(messages: Message[]) {
  const meaningfulUserMessages = getMeaningfulUserMessages(messages);
  const source =
    meaningfulUserMessages[0] ||
    messages.find((message) => message.role === "user")?.content ||
    "Conversation";

  const words = normalizeText(source)
    .replace(/[“”"'.!?]+$/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 6);

  const fallback = words.join(" ");

  return fallback || "Conversation";
}

function createFallbackSummary(messages: Message[]) {
  const meaningfulUserMessages = getMeaningfulUserMessages(messages);
  const source = meaningfulUserMessages[0] || "A saved conversation with MindLog.";
  const cleaned = normalizeText(source);

  if (cleaned.length <= 180) {
    return cleaned;
  }

  return `${cleaned.slice(0, 180).trim()}…`;
}

function cleanTitle(value: string | undefined, fallback: string) {
  const cleaned = normalizeText(value || "")
    .replace(/^["“”'`]+|["“”'`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  const normalized = normalizeForDetection(cleaned);

  const adviceLikeOpenings = [
    "just say",
    "say how",
    "tell her",
    "tell him",
    "you should",
    "you need",
    "try to",
    "tap save",
    "save to",
    "write it",
    "ask her",
    "ask him",
  ];

  if (adviceLikeOpenings.some((opening) => normalized.startsWith(opening))) {
    return fallback;
  }

  const words = cleaned.split(" ").filter(Boolean);

  if (words.length > 8) {
    return words.slice(0, 8).join(" ");
  }

  return cleaned;
}

function cleanShortText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = normalizeText(value)
    .replace(/^["“”'`]+|["“”'`]+$/g, "")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength).trim()}…`;
}

function normalizeMood(value: string | undefined): Mood {
  const normalized = normalizeForDetection(value || "");

  if (ALLOWED_MOODS.includes(normalized as Mood)) {
    return normalized as Mood;
  }

  return "calm";
}

function normalizeChatType(value: unknown): ReflectionMetadata["chatType"] {
  const normalized = normalizeForDetection(
    typeof value === "string" ? value : ""
  ).replace(/\s+/g, "_") as ReflectionMetadata["chatType"];

  if (ALLOWED_CHAT_TYPES.includes(normalized)) {
    return normalized;
  }

  return "personal_reflection";
}

function normalizeThemes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 4);
}

async function generateJournalMetadata(
  messages: Message[]
): Promise<JournalMetadata> {
  const fallbackTitle = createFallbackTitle(messages);
  const fallbackSummary = createFallbackSummary(messages);

  const conversationText = messages
    .map((message) => `${message.role}: ${normalizeText(message.content)}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: getJournalModel(),
    temperature: 0.25,
    max_completion_tokens: 360,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You create metadata for a saved MindLog journal reflection.",
          "Return ONLY valid JSON.",
          "JSON shape: { \"title\": string, \"mood\": string, \"summary\": string, \"keyTakeaway\": string, \"themes\": string[], \"chatType\": string }.",
          "Allowed mood values: calm, reflective, heavy, anxious, hopeful, happy, sad, excited, confused, casual.",
          "Allowed chatType values: personal_reflection, emotional_check_in, relationship_reflection, decision_moment, work_reflection, casual_conversation, planning.",
          "Use casual for light everyday chats, simple conversation, status topics, cars, plans, or low-emotion talk.",
          "Use happy for warm positive moments. Use excited for energetic anticipation. Use sad for clearly sad or disappointed moments. Use confused when the user is unsure or mentally tangled.",
          "The title must describe the user's lived moment, not MindLog's advice.",
          "Do not quote assistant advice as the title.",
          "Do not create instruction-like titles such as 'Just say how you feel calmly'.",
          "Do not use generic titles like 'Reflection', 'Conversation', or 'Journal Entry' unless there is no meaningful content.",
          "Title should be human, specific, calm, and max 6 words when possible.",
          "Summary should be one sentence, specific to this saved chat, max 32 words.",
          "Key takeaway should be one concise sentence the user may want to remember, max 24 words.",
          "Themes should contain 1-4 short human labels, not hashtags.",
          "No punctuation at the end of the title.",
        ].join("\n"),
      },
      {
        role: "user",
        content: conversationText,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "{}";

  let parsed: Record<string, unknown> = {};

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const summary = cleanShortText(
    parsed.summary,
    fallbackSummary,
    220
  );

  return {
    title: cleanTitle(
      typeof parsed.title === "string" ? parsed.title : undefined,
      fallbackTitle
    ),
    mood: normalizeMood(
      typeof parsed.mood === "string" ? parsed.mood : undefined
    ),
    reflection: {
      summary,
      keyTakeaway: cleanShortText(
        parsed.keyTakeaway,
        summary,
        180
      ),
      themes: normalizeThemes(parsed.themes),
      chatType: normalizeChatType(parsed.chatType),
    },
  };
}

function isValidMessagesArray(value: unknown): value is Message[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const messages = body?.messages;

    if (!isValidMessagesArray(messages)) {
      return NextResponse.json(
        { error: "No valid messages provided" },
        { status: 400 }
      );
    }

    const subscription = await resolveUserSubscription(
      supabase,
      user.id
    );

    const journalLimit = getJournalLimit(subscription.plan);

    if (typeof journalLimit === "number") {
      const { count, error: countError } = await supabase
        .from("journals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null);

      if (countError) {
        console.error("Journal count error:", countError);

        return NextResponse.json(
          { error: "Failed to check save limit" },
          { status: 500 }
        );
      }

      const used = count ?? 0;

      if (used >= journalLimit) {
        return NextResponse.json(
          {
            error: "Free plan save limit reached",
            code: "FREE_LIMIT_REACHED",
            plan: subscription.plan,
            used,
            limit: journalLimit,
            remaining: 0,
            canSave: false,
            upgradeUrl: "/upgrade",
          },
          { status: 403 }
        );
      }
    }

    const fallbackTitle = createFallbackTitle(messages);

    let title = fallbackTitle;
    let mood: Mood = "calm";
    let reflectionMetadata: ReflectionMetadata | null = null;

    try {
      const metadata = await generateJournalMetadata(messages);

      title = metadata.title || fallbackTitle;
      mood = metadata.mood || "calm";
      reflectionMetadata = metadata.reflection;
    } catch (error) {
      console.warn("AI metadata failed:", error);
    }

    const { data, error } = await supabase
      .from("journals")
      .insert([
        {
          user_id: user.id,
          title,
          mood,
          content: messages,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);

      return NextResponse.json(
        { error: "Failed to save conversation" },
        { status: 500 }
      );
    }

    if (data?.id && reflectionMetadata) {
      const { data: updatedData, error: metadataError } = await supabase
        .from("journals")
        .update({
          metadata: reflectionMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (!metadataError && updatedData) {
        return NextResponse.json(updatedData);
      }

      if (metadataError) {
        console.warn(
          "Journal metadata update skipped:",
          metadataError.message
        );
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("CLOSE CONVERSATION ERROR:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
