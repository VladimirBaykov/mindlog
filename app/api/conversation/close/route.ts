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

type Mood = "calm" | "reflective" | "heavy" | "anxious" | "hopeful";

type JournalMetadata = {
  title: string;
  mood: Mood;
};

const ALLOWED_MOODS: Mood[] = [
  "calm",
  "reflective",
  "heavy",
  "anxious",
  "hopeful",
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

function normalizeMood(value: string | undefined): Mood {
  const normalized = normalizeForDetection(value || "");

  if (ALLOWED_MOODS.includes(normalized as Mood)) {
    return normalized as Mood;
  }

  return "calm";
}

async function generateJournalMetadata(
  messages: Message[]
): Promise<JournalMetadata> {
  const fallbackTitle = createFallbackTitle(messages);

  const conversationText = messages
    .map((message) => `${message.role}: ${normalizeText(message.content)}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: getJournalModel(),
    temperature: 0.25,
    max_completion_tokens: 160,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You create metadata for a saved MindLog journal reflection.",
          "Return ONLY valid JSON.",
          "JSON shape: { \"title\": string, \"mood\": string }.",
          "Allowed mood values: calm, reflective, heavy, anxious, hopeful.",
          "The title must describe the user's lived moment, not MindLog's advice.",
          "Do not quote assistant advice as the title.",
          "Do not create instruction-like titles such as 'Just say how you feel calmly'.",
          "Do not use generic titles like 'Reflection', 'Conversation', or 'Journal Entry' unless there is no meaningful content.",
          "Title should be human, specific, calm, and max 6 words when possible.",
          "No punctuation at the end of the title.",
          "If the user is nervous but moving toward something meaningful, choose anxious or hopeful based on the dominant tone.",
        ].join("\n"),
      },
      {
        role: "user",
        content: conversationText,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "{}";

  let parsed: Partial<JournalMetadata> = {};

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    title: cleanTitle(parsed.title, fallbackTitle),
    mood: normalizeMood(parsed.mood),
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

    try {
      const metadata = await generateJournalMetadata(messages);

      title = metadata.title || fallbackTitle;
      mood = metadata.mood || "calm";
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

    return NextResponse.json(data);
  } catch (error) {
    console.error("CLOSE CONVERSATION ERROR:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}