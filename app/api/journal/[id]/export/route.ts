import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { resolveUserSubscription } from "@/lib/billing";
import { hasFeatureAccess } from "@/lib/plans";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { id } = await context.params;

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

    const canExport = hasFeatureAccess(
      subscription.plan,
      "pdf_export"
    );

    if (!canExport) {
      return NextResponse.json(
        {
          error: "Pro feature locked",
          code: "PRO_REQUIRED",
          locked: true,
          feature: "pdf_export",
          upgradeUrl: "/upgrade",
        },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("journals")
      .select("id, title, mood, created_at, updated_at, content")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Journal not found" },
        { status: 404 }
      );
    }

    const messages = Array.isArray(data.content)
      ? (data.content as Message[])
      : [];

    return NextResponse.json({
      id: data.id,
      title: data.title || "Conversation",
      mood: data.mood || "calm",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      messages,
    });
  } catch (e: any) {
    console.error("JOURNAL EXPORT ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}