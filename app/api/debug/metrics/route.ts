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

type DailyPoint = {
  date: string;
  count: number;
};

type FunnelStats = {
  onboardingCompleted30d: number;
  chatStarted30d: number;
  conversationSaved30d: number;
  checkoutStarted30d: number;
  activeProCurrent: number;
  onboardingToChatPercent: number;
  chatToSavePercent: number;
  saveToCheckoutPercent: number;
  checkoutToActiveProPercent: number;
};

type DropoffGroup = {
  count: number;
  sampleUserIds: string[];
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

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDailySeriesFromTimestamps(
  timestamps: string[],
  days: number
): DailyPoint[] {
  const counts: Record<string, number> = {};
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    counts[formatDayKey(d)] = 0;
  }

  for (const timestamp of timestamps) {
    const key = formatDayKey(new Date(timestamp));
    if (key in counts) {
      counts[key] += 1;
    }
  }

  return Object.entries(counts).map(([date, count]) => ({
    date,
    count,
  }));
}

function buildDailyEventSeries(
  events: AnalyticsRow[],
  eventName: string,
  days: number
) {
  return buildDailySeriesFromTimestamps(
    events
      .filter((event) => event.event_name === eventName)
      .map((event) => event.created_at),
    days
  );
}

function isMissingAnalyticsTableError(error: any) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "PGRST205" ||
    (message.includes("analytics_events") &&
      message.includes("schema cache"))
  );
}

function sampleIds(ids: Set<string>, limit = 8) {
  return Array.from(ids).slice(0, limit);
}

function buildFunnel(
  analytics30d: AnalyticsRow[],
  subscriptions: SubscriptionRow[]
): FunnelStats {
  const onboardingUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "onboarding_completed")
      .map((event) => event.user_id)
  );

  const chatStartedUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "chat_started")
      .map((event) => event.user_id)
  );

  const savedUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "conversation_saved")
      .map((event) => event.user_id)
  );

  const checkoutUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "upgrade_checkout_started")
      .map((event) => event.user_id)
  );

  const activeProUsers = new Set(
    subscriptions
      .filter((row) => row.plan === "pro" && row.status === "active")
      .map((row) => row.user_id)
  );

  const onboardingCount = onboardingUsers.size;
  const chatStartedCount = chatStartedUsers.size;
  const savedCount = savedUsers.size;
  const checkoutCount = checkoutUsers.size;
  const activeProCount = activeProUsers.size;

  function percent(part: number, total: number) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  return {
    onboardingCompleted30d: onboardingCount,
    chatStarted30d: chatStartedCount,
    conversationSaved30d: savedCount,
    checkoutStarted30d: checkoutCount,
    activeProCurrent: activeProCount,
    onboardingToChatPercent: percent(
      chatStartedCount,
      onboardingCount
    ),
    chatToSavePercent: percent(savedCount, chatStartedCount),
    saveToCheckoutPercent: percent(checkoutCount, savedCount),
    checkoutToActiveProPercent: percent(
      activeProCount,
      checkoutCount
    ),
  };
}

function buildDropoffs(
  analytics30d: AnalyticsRow[],
  subscriptions: SubscriptionRow[]
) {
  const onboardingUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "onboarding_completed")
      .map((event) => event.user_id)
  );

  const chatStartedUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "chat_started")
      .map((event) => event.user_id)
  );

  const savedUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "conversation_saved")
      .map((event) => event.user_id)
  );

  const checkoutUsers = new Set(
    analytics30d
      .filter((event) => event.event_name === "upgrade_checkout_started")
      .map((event) => event.user_id)
  );

  const activeProUsers = new Set(
    subscriptions
      .filter((row) => row.plan === "pro" && row.status === "active")
      .map((row) => row.user_id)
  );

  const onboardingNoChat = new Set<string>();
  const chatNoSave = new Set<string>();
  const saveNoCheckout = new Set<string>();
  const checkoutNoActivePro = new Set<string>();

  for (const userId of onboardingUsers) {
    if (!chatStartedUsers.has(userId)) {
      onboardingNoChat.add(userId);
    }
  }

  for (const userId of chatStartedUsers) {
    if (!savedUsers.has(userId)) {
      chatNoSave.add(userId);
    }
  }

  for (const userId of savedUsers) {
    if (!checkoutUsers.has(userId)) {
      saveNoCheckout.add(userId);
    }
  }

  for (const userId of checkoutUsers) {
    if (!activeProUsers.has(userId)) {
      checkoutNoActivePro.add(userId);
    }
  }

  return {
    onboardingCompletedNoChat: {
      count: onboardingNoChat.size,
      sampleUserIds: sampleIds(onboardingNoChat),
    } satisfies DropoffGroup,
    chatStartedNoSave: {
      count: chatNoSave.size,
      sampleUserIds: sampleIds(chatNoSave),
    } satisfies DropoffGroup,
    conversationSavedNoCheckout: {
      count: saveNoCheckout.size,
      sampleUserIds: sampleIds(saveNoCheckout),
    } satisfies DropoffGroup,
    checkoutStartedNoActivePro: {
      count: checkoutNoActivePro.size,
      sampleUserIds: sampleIds(checkoutNoActivePro),
    } satisfies DropoffGroup,
  };
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
      journalsPerUserResult,
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
        .from("journals")
        .select("user_id, created_at")
        .is("deleted_at", null),

      adminSupabase
        .from("analytics_events")
        .select("id, user_id, event_name, page, metadata, created_at")
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(700),

      adminSupabase
        .from("analytics_events")
        .select("id, user_id, event_name, page, metadata, created_at")
        .gte("created_at", since30d)
        .order("created_at", { ascending: false })
        .limit(5000),

      adminSupabase
        .from("analytics_events")
        .select("id, user_id, event_name, page, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (journalsTotalResult.error) throw journalsTotalResult.error;
    if (journals7dResult.error) throw journals7dResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (journalsPerUserResult.error) throw journalsPerUserResult.error;

    const subscriptions =
      (subscriptionsResult.data as SubscriptionRow[]) ?? [];

    const journalRows =
      (journalsPerUserResult.data as Array<{
        user_id: string;
        created_at: string;
      }>) ?? [];

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

    let analyticsAvailable = true;
    let analytics7d: AnalyticsRow[] = [];
    let analytics30d: AnalyticsRow[] = [];
    let recentEvents: AnalyticsRow[] = [];

    if (
      analytics7dResult.error ||
      analytics30dResult.error ||
      recentEventsResult.error
    ) {
      const firstError =
        analytics7dResult.error ||
        analytics30dResult.error ||
        recentEventsResult.error;

      if (isMissingAnalyticsTableError(firstError)) {
        analyticsAvailable = false;
      } else {
        throw firstError;
      }
    } else {
      analytics7d = (analytics7dResult.data as AnalyticsRow[]) ?? [];
      analytics30d = (analytics30dResult.data as AnalyticsRow[]) ?? [];
      recentEvents = (recentEventsResult.data as AnalyticsRow[]) ?? [];
    }

    const eventCounts7d = analyticsAvailable
      ? groupCounts(analytics7d.map((item) => item.event_name))
      : {};

    const eventCounts30d = analyticsAvailable
      ? groupCounts(analytics30d.map((item) => item.event_name))
      : {};

    const uniqueActiveUsers7d = analyticsAvailable
      ? new Set(analytics7d.map((item) => item.user_id)).size
      : 0;

    const uniqueActiveUsers30d = analyticsAvailable
      ? new Set(analytics30d.map((item) => item.user_id)).size
      : 0;

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
      saversActiveBuckets: analyticsAvailable
        ? bucketUsersByEventDays(analytics30d, "conversation_saved")
        : { d1: 0, d3: 0, d7: 0, d14: 0, d30: 0 },
      startersActiveBuckets: analyticsAvailable
        ? bucketUsersByEventDays(analytics30d, "chat_started")
        : { d1: 0, d3: 0, d7: 0, d14: 0, d30: 0 },
      repeatSavers30d: analyticsAvailable
        ? buildRepeatSaverStats(analytics30d)
        : {
            usersWith1Save: 0,
            usersWith2Saves: 0,
            usersWith3Saves: 0,
            usersWith5Saves: 0,
          },
      topSavers: buildTopSavers(journalAggregates, 10),
    };

    const trends = {
      journalsDaily30d: buildDailySeriesFromTimestamps(
        journalRows.map((row) => row.created_at),
        30
      ),
      conversationSavedDaily30d: analyticsAvailable
        ? buildDailyEventSeries(
            analytics30d,
            "conversation_saved",
            30
          )
        : buildDailySeriesFromTimestamps([], 30),
      checkoutStartedDaily30d: analyticsAvailable
        ? buildDailyEventSeries(
            analytics30d,
            "upgrade_checkout_started",
            30
          )
        : buildDailySeriesFromTimestamps([], 30),
    };

    const funnel = analyticsAvailable
      ? buildFunnel(analytics30d, subscriptions)
      : {
          onboardingCompleted30d: 0,
          chatStarted30d: 0,
          conversationSaved30d: 0,
          checkoutStarted30d: 0,
          activeProCurrent: activeSubscriptions,
          onboardingToChatPercent: 0,
          chatToSavePercent: 0,
          saveToCheckoutPercent: 0,
          checkoutToActiveProPercent: 0,
        };

    const dropoffs = analyticsAvailable
      ? buildDropoffs(analytics30d, subscriptions)
      : {
          onboardingCompletedNoChat: {
            count: 0,
            sampleUserIds: [],
          },
          chatStartedNoSave: {
            count: 0,
            sampleUserIds: [],
          },
          conversationSavedNoCheckout: {
            count: 0,
            sampleUserIds: [],
          },
          checkoutStartedNoActivePro: {
            count: 0,
            sampleUserIds: [],
          },
        };

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      analyticsAvailable,
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
        totalEvents7d: analyticsAvailable ? analytics7d.length : 0,
        totalEvents30d: analyticsAvailable ? analytics30d.length : 0,
        uniqueActiveUsers7d,
        uniqueActiveUsers30d,
        eventCounts7d,
        eventCounts30d,
        conversionSignals,
      },
      retention,
      trends,
      funnel,
      dropoffs,
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