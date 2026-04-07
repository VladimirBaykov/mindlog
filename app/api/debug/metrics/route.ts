import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

type AnalyticsRow = {
  id: string;
  user_id: string;
  event_name: string;
  page: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

function getSinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function groupCounts<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const adminSupabase = createSupabaseAdminClient();

    const since7d = getSinceDate(7);
    const since30d = getSinceDate(30);

    const [
      journalsTotalResult,
      journals7dResult,
      subscriptionsResult,
      analytics7dResult,
      analytics30dResult,
      recentEventsResult,
    ] = await Promise.all([
      adminSupabase
        .from("journals")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null),

      adminSupabase
        .from("journals")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", since7d),

      adminSupabase
        .from("subscriptions")
        .select(
          "id, user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end, created_at, updated_at"
        ),

      adminSupabase
        .from("analytics_events")
        .select("id, user_id, event_name, page, metadata, created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(500),

      adminSupabase
        .from("analytics_events")
        .select("id, user_id, event_name, page, metadata, created_at")
        .gte("created_at", since30d)
        .order("created_at", { ascending: false })
        .limit(2000),

      adminSupabase
        .from("analytics_events")
        .select("id, user_id, event_name, page, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (journalsTotalResult.error) throw journalsTotalResult.error;
    if (journals7dResult.error) throw journals7dResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (analytics7dResult.error) throw analytics7dResult.error;
    if (analytics30dResult.error) throw analytics30dResult.error;
    if (recentEventsResult.error) throw recentEventsResult.error;

    const subscriptions =
      (subscriptionsResult.data as SubscriptionRow[]) ?? [];

    const analytics7d =
      (analytics7dResult.data as AnalyticsRow[]) ?? [];
    const analytics30d =
      (analytics30dResult.data as AnalyticsRow[]) ?? [];
    const recentEvents =
      (recentEventsResult.data as AnalyticsRow[]) ?? [];

    const activeSubscriptions = subscriptions.filter(
      (item) => item.plan === "pro" && item.status === "active"
    ).length;

    const billingStatusCounts = groupCounts(
      subscriptions.map((item) => item.status || "inactive")
    );

    const billingPlanCounts = groupCounts(
      subscriptions.map((item) => item.plan || "free")
    );

    const eventCounts7d = groupCounts(
      analytics7d.map((item) => item.event_name)
    );

    const eventCounts30d = groupCounts(
      analytics30d.map((item) => item.event_name)
    );

    const uniqueActiveUsers7d = new Set(
      analytics7d.map((item) => item.user_id)
    ).size;

    const uniqueActiveUsers30d = new Set(
      analytics30d.map((item) => item.user_id)
    ).size;

    const conversionSignals = {
      checkoutStarts7d:
        eventCounts7d["upgrade_checkout_started"] || 0,
      conversationSaved7d:
        eventCounts7d["conversation_saved"] || 0,
      exportOpened7d:
        eventCounts7d["journal_export_opened"] || 0,
      chatLimitsHit7d:
        eventCounts7d["chat_limit_hit"] || 0,
      portalOpened7d:
        eventCounts7d["billing_portal_opened"] || 0,
    };

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      journals: {
        total: journalsTotalResult.count ?? 0,
        last7d: journals7dResult.count ?? 0,
      },
      subscriptions: {
        total: subscriptions.length,
        activePro: activeSubscriptions,
        byStatus: billingStatusCounts,
        byPlan: billingPlanCounts,
      },
      analytics: {
        totalEvents7d: analytics7d.length,
        totalEvents30d: analytics30d.length,
        uniqueActiveUsers7d,
        uniqueActiveUsers30d,
        eventCounts7d,
        eventCounts30d,
        conversionSignals,
      },
      recentEvents,
    });
  } catch (e: any) {
    console.error("DEBUG METRICS ERROR:", e);

    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}