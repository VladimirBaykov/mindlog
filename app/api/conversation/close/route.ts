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

async function generateTitle(messages: Message[]) {
  const text = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Generate a very short journal title (max 6 words). Emotional, human, calm tone. No punctuation.",
      },
      { role: "user", content: text },
    ],
  });

  return res.choices[0].message.content?.trim();
}

async function detectMood(messages: Message[]) {
  const text = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are classifying the emotional tone of a private journal conversation.

Return ONLY one of these moods:
calm, reflective, heavy, anxious, hopeful
`,
      },
      { role: "user", content: text },
    ],
  });

  return res.choices[0].message.content?.trim()?.toLowerCase();
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

    const firstUserMessage = messages.find(
      (m) => m.role === "user"
    )?.content;

    const fallbackTitle =
      firstUserMessage?.slice(0, 48) || "Conversation";

    let title = fallbackTitle;
    let mood = "calm";

    try {
      const [t, m] = await Promise.all([
        generateTitle(messages),
        detectMood(messages),
      ]);

      title = t || fallbackTitle;
      mood = m || "calm";
    } catch (e) {
      console.warn("AI metadata failed:", e);
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
  } catch (e) {
    console.error("CLOSE CONVERSATION ERROR:", e);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}