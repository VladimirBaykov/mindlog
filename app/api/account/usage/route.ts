import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getJournalLimit } from "@/lib/plans";
import { resolveUserSubscription } from "@/lib/billing";

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

    const { count, error } = await supabase
      .from("journals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const used = count ?? 0;
    const limit = getJournalLimit(subscription.isPro ? "pro" : "free");
    const remaining =
      typeof limit === "number" ? Math.max(0, limit - used) : null;
    const canSave =
      typeof limit === "number" ? used < limit : true;

    return NextResponse.json({
      plan: subscription.isPro ? "pro" : "free",
      status: subscription.status,
      used,
      limit,
      remaining,
      canSave,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });
  } catch (e: any) {
    console.error("ACCOUNT USAGE ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}