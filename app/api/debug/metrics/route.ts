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

type JournalAggregateRow = {
  user_id: string;
  count: number;
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

function bucketUsersByEventDays(
  events: AnalyticsRow[],
  eventName: string
) {
  const now = Date.now();
  const userLastSeen = new Map<string, number>();

  for (const event of events) {
    if (event.event_name !== eventName) continue;

    const timestamp = new Date(event.created_at).getTime();
    const existing = userLastSeen.get(event.user_id);

    if (!existing || timestamp > existing) {
      userLastSeen.set(event.user_id, timestamp);
    }
  }

  const buckets = {
    d1: 0,
    d3: 0,
    d7: 0,
    d14: 0,
    d30: 0,
  };

  for (const [, ts] of userLastSeen) {
    const diffDays = (now - ts) / (1000 * 60 * 60 * 24);

    if (diffDays <= 1) buckets.d1 += 1;
    if (diffDays <= 3) buckets.d3 += 1;
    if (diffDays <= 7) buckets.d7 += 1;
    if (diffDays <= 14) buckets.d14 += 1;
    if (diffDays <= 30) buckets.d30 += 1;
  }

  return buckets;
}

function buildRepeatSaverStats(events: AnalyticsRow[]) {
  const saveCounts = events
    .filter((event) => event.event_name === "conversation_saved")
    .reduce<Record<string, number>>((acc, event) => {
      acc[event.user_id] = (acc[event.user_id] || 0) + 1;
      return acc;
    }, {});

  const counts = Object.values(saveCounts);

  return {
    usersWith1Save: counts.filter((count) => count >= 1).length,
    usersWith2Saves: counts.filter((count) => count >= 2).length,
    usersWith3Saves: counts.filter((count) => count >= 3).length,
    usersWith5Saves: counts.filter((count) => count >= 5).length,
  };
}

function buildTopSavers(
  rows: JournalAggregateRow[],
  limit = 10
) {
  return rows
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
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
      journalsPerUserResult,
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
        .limit(3000),

      adminSupabase
        .from("analytics_events")
        .select("id, user_id, event_name, page, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(30),

      adminSupabase
        .from("journals")
        .select("user_id")
        .is("deleted_at", null),
    ]);

    if (journalsTotalResult.error) throw journalsTotalResult.error;
    if (journals7dResult.error) throw journals7dResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (analytics7dResult.error) throw analytics7dResult.error;
    if (analytics30dResult.error) throw analytics30dResult.error;
    if (recentEventsResult.error) throw recentEventsResult.error;
    if (journalsPerUserResult.error) throw journalsPerUserResult.error;

    const subscriptions =
      (subscriptionsResult.data as SubscriptionRow[]) ?? [];

    const analytics7d =
      (analytics7dResult.data as AnalyticsRow[]) ?? [];
    const analytics30d =
      (analytics30dResult.data as AnalyticsRow[]) ?? [];
    const recentEvents =
      (recentEventsResult.data as AnalyticsRow[]) ?? [];

    const journalRows =
      (journalsPerUserResult.data as Array<{ user_id: string }>) ?? [];

    const journalCountsByUser = journalRows.reduce<
      Record<string, number>
    >((acc, row) => {
      acc[row.user_id] = (acc[row.user_id] || 0) + 1;
      return acc;
    }, {});

    const journalAggregates: JournalAggregateRow[] =
      Object.entries(journalCountsByUser).map(
        ([user_id, count]) => ({
          user_id,
          count,
        })
      );

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

    const retention = {
      saversActiveBuckets: bucketUsersByEventDays(
        analytics30d,
        "conversation_saved"
      ),
      startersActiveBuckets: bucketUsersByEventDays(
        analytics30d,
        "chat_started"
      ),
      repeatSavers30d: buildRepeatSaverStats(analytics30d),
      topSavers: buildTopSavers(journalAggregates, 10),
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
      retention,
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