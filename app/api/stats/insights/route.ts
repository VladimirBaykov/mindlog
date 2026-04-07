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
      "ai_insights"
    );

    if (!canAccess) {
      return NextResponse.json(
        {
          error: "Pro feature locked",
          code: "PRO_REQUIRED",
          locked: true,
          feature: "ai_insights",
          upgradeUrl: "/upgrade",
          insights: [],
        },
        { status: 403 }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - 14);

    const { data, error } = await supabase
      .from("journals")
      .select("id, title, mood, created_at, content")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const entries = (data ?? []) as JournalRow[];

    if (entries.length === 0) {
      return NextResponse.json({
        insights: [
          "No insights yet — write a few reflections and MindLog will start surfacing patterns.",
        ],
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

    let insights = [
      "You’ve been showing up consistently for reflection.",
      "Your recent entries suggest emotional self-awareness is growing.",
      "A clearer pattern will appear as more entries accumulate.",
    ];

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are generating supportive product insights for a private journaling app. Return exactly 3 short insights, each on a new line. No numbering. No bullets. Warm, thoughtful, concise. Avoid clinical language.",
          },
          {
            role: "user",
            content: `Generate 3 helpful emotional pattern insights based on these recent journal entries:\n\n${JSON.stringify(
              compactPayload,
              null,
              2
            )}`,
          },
        ],
      });

      const text =
        response.choices[0]?.message?.content?.trim() || "";

      const parsed = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);

      if (parsed.length > 0) {
        insights = parsed;
      }
    } catch (aiError) {
      console.warn("Insights AI failed:", aiError);
    }

    return NextResponse.json({
      insights,
      locked: false,
    });
  } catch (e: any) {
    console.error("INSIGHTS ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}