import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolveUserSubscription } from "@/lib/billing";
import { hasFeatureAccess } from "@/lib/plans";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Message = {
  role: "user" | "assistant";
  content: string;
};

type JournalRow = {
  id: string;
  title: string | null;
  mood: string | null;
  created_at: string;
  content: Message[] | null;
};

export async function GET() {
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

    const subscription = await resolveUserSubscription(
      supabase,
      user.id
    );

    const canAccess = hasFeatureAccess(
      subscription.plan,
      "weekly_summary"
    );

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Pro feature locked",
          code: "PRO_REQUIRED",
          locked: true,
          feature: "weekly_summary",
          upgradeUrl: "/upgrade",
          summary:
            "Weekly reflection is available on MindLog Pro. Upgrade to unlock deeper 7-day summaries and stronger reflection patterns.",
          totalEntries: null,
          moods: null,
        },
        { status: 403 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data, error } = await supabase
      .from("journals")
      .select("id, title, mood, created_at, content")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const entries = (data ?? []) as JournalRow[];

    if (entries.length === 0) {
      return NextResponse.json({
        summary:
          "No entries yet this week. Once you write a few reflections, your weekly summary will appear here.",
        totalEntries: 0,
        moods: {},
        locked: false,
      });
    }

    const compactPayload = entries.map((entry) => {
      const firstUserMessage =
        entry.content?.find((m) => m.role === "user")?.content ?? "";

      return {
        title: entry.title ?? "Conversation",
        mood: entry.mood ?? "unknown",
        created_at: entry.created_at,
        preview: firstUserMessage.slice(0, 220),
      };
    });

    let summary =
      "This week shows a mix of reflection and emotional processing.";

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You write weekly reflection summaries for a private journaling app. Be warm, calm, concise, and emotionally intelligent. Write 3-5 sentences. Do not sound clinical. Do not use bullet points.",
          },
          {
            role: "user",
            content: `Summarize this user's last 7 days of journal activity:\n\n${JSON.stringify(
              compactPayload,
              null,
              2
            )}`,
          },
        ],
      });

      summary =
        response.choices[0]?.message?.content?.trim() ||
        summary;
    } catch (aiError) {
      console.warn("Weekly summary AI failed:", aiError);
    }

    const moodCount = entries.reduce<Record<string, number>>(
      (acc, entry) => {
        const mood = entry.mood || "unknown";
        acc[mood] = (acc[mood] || 0) + 1;
        return acc;
      },
      {}
    );

    return NextResponse.json({
      summary,
      totalEntries: entries.length,
      moods: moodCount,
      locked: false,
    });
  } catch (e: any) {
    console.error("WEEKLY SUMMARY ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}