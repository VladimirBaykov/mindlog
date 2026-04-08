"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import { useHeader } from "@/components/header/HeaderContext";
import { supabase } from "@/lib/supabase-browser";

type DailyPoint = {
  date: string;
  count: number;
};

type DropoffGroup = {
  count: number;
  sampleUserIds: string[];
};

type DebugMetricsResponse = {
  generatedAt: string;
  analyticsAvailable: boolean;
  journals: {
    total: number;
    last7d: number;
  };
  subscriptions: {
    total: number;
    activePro: number;
    byStatus: Record<string, number>;
    byPlan: Record<string, number>;
  };
  analytics: {
    totalEvents7d: number;
    totalEvents30d: number;
    uniqueActiveUsers7d: number;
    uniqueActiveUsers30d: number;
    eventCounts7d: Record<string, number>;
    eventCounts30d: Record<string, number>;
    conversionSignals: {
      checkoutStarts7d: number;
      conversationSaved7d: number;
      exportOpened7d: number;
      chatLimitsHit7d: number;
      portalOpened7d: number;
    };
  };
  retention: {
    saversActiveBuckets: {
      d1: number;
      d3: number;
      d7: number;
      d14: number;
      d30: number;
    };
    startersActiveBuckets: {
      d1: number;
      d3: number;
      d7: number;
      d14: number;
      d30: number;
    };
    repeatSavers30d: {
      usersWith1Save: number;
      usersWith2Saves: number;
      usersWith3Saves: number;
      usersWith5Saves: number;
    };
    topSavers: Array<{
      user_id: string;
      count: number;
    }>;
  };
  trends: {
    journalsDaily30d: DailyPoint[];
    conversationSavedDaily30d: DailyPoint[];
    checkoutStartedDaily30d: DailyPoint[];
  };
  funnel: {
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
  dropoffs: {
    onboardingCompletedNoChat: DropoffGroup;
    chatStartedNoSave: DropoffGroup;
    conversationSavedNoCheckout: DropoffGroup;
    checkoutStartedNoActivePro: DropoffGroup;
  };
  recentEvents: Array<{
    id: string;
    user_id: string;
    event_name: string;
    page: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
};

function Sparkline({
  points,
}: {
  points: DailyPoint[];
}) {
  const max = Math.max(...points.map((p) => p.count), 1);

  return (
    <div className="flex h-24 items-end gap-1">
      {points.map((point) => (
        <div
          key={point.date}
          className="flex min-w-0 flex-1 flex-col items-center justify-end"
        >
          <div
            className="w-full rounded-t-sm bg-white/80"
            style={{
              height: `${Math.max(6, (point.count / max) * 100)}%`,
            }}
            title={`${point.date}: ${point.count}`}
          />
        </div>
      ))}
    </div>
  );
}

function DropoffCard({
  title,
  description,
  group,
}: {
  title: string;
  description: string;
  group: DropoffGroup;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm font-medium text-white">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">
        {description}
      </p>

      <div className="mt-4 text-3xl font-semibold text-white">
        {group.count}
      </div>

      {group.sampleUserIds.length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Sample users
          </div>
          <div className="mt-3 space-y-2">
            {group.sampleUserIds.map((userId) => (
              <div
                key={userId}
                className="truncate text-xs text-neutral-400"
              >
                {userId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DebugPage() {
  const router = useRouter();
  const { setHeader, resetHeader } = useHeader();

  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [metrics, setMetrics] =
    useState<DebugMetricsResponse | null>(null);

  useEffect(() => {
    setHeader({
      title: "Debug metrics",
      leftSlot: (
        <button
          onClick={() => router.push("/profile")}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Profile
        </button>
      ),
      menuItems: [
        {
          label: "Journal",
          onClick: () => router.push("/journal"),
        },
        {
          label: "Stats",
          onClick: () => router.push("/stats"),
        },
        {
          label: "Logout",
          danger: true,
          onClick: async () => {
            await supabase.auth.signOut();
            router.refresh();
            router.push("/sign-in");
          },
        },
      ],
    });

    return () => resetHeader();
  }, [router, resetHeader, setHeader]);

  async function loadMetrics() {
    try {
      setLoading(true);
      setForbidden(false);

      const res = await fetch("/api/debug/metrics", {
        cache: "no-store",
      });

      if (res.status === 403) {
        setForbidden(true);
        setMetrics(null);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to load debug metrics");
      }

      const data = (await res.json()) as DebugMetricsResponse;
      setMetrics(data);
    } catch (error) {
      console.error(error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetrics();
  }, []);

  const orderedEventCounts7d = useMemo(() => {
    if (!metrics?.analytics.eventCounts7d) {
      return [];
    }

    return Object.entries(metrics.analytics.eventCounts7d).sort(
      (a, b) => b[1] - a[1]
    );
  }, [metrics]);

  const orderedBillingStatuses = useMemo(() => {
    if (!metrics?.subscriptions.byStatus) {
      return [];
    }

    return Object.entries(metrics.subscriptions.byStatus).sort(
      (a, b) => b[1] - a[1]
    );
  }, [metrics]);

  if (loading) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-5xl px-4 pt-24 pb-24">
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="h-4 w-20 animate-pulse rounded-full bg-white/[0.08]" />
                  <div className="mt-4 h-8 w-24 animate-pulse rounded-full bg-white/[0.06]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AuthGate>
    );
  }

  if (forbidden) {
    return (
      <AuthGate>
        <div className="min-h-screen bg-black text-white">
          <div className="mx-auto max-w-xl px-4 pt-24 pb-24">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
                ⊘
              </div>

              <h1 className="mt-4 text-2xl font-semibold text-white">
                Access denied
              </h1>

              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
                This debug page is only available to admin emails listed
                in the <code>ADMIN_EMAILS</code> environment variable.
              </p>

              <button
                onClick={() => router.push("/profile")}
                className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Back to profile
              </button>
            </div>
          </div>
        </div>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-5xl px-4 pt-24 pb-24 space-y-6">
          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Internal ops snapshot
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Product, billing, analytics, and retention signals from
                Supabase.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={loadMetrics}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Refresh metrics
              </button>

              {metrics?.generatedAt && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-400">
                  Updated{" "}
                  {new Date(metrics.generatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {!metrics?.analyticsAvailable && (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 px-5 py-5">
              <div className="text-sm font-medium text-white">
                Analytics table is not active yet
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                The product is running, but <code>analytics_events</code>{" "}
                is not available in Supabase yet.
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Journals total
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {metrics?.journals.total ?? 0}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Journals 7d
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {metrics?.journals.last7d ?? 0}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Active Pro
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {metrics?.subscriptions.activePro ?? 0}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Active users 7d
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {metrics?.analytics.uniqueActiveUsers7d ?? 0}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Events 30d
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {metrics?.analytics.totalEvents30d ?? 0}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white">
              30-day conversion funnel
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">
                  Onboarding completed
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {metrics?.funnel.onboardingCompleted30d ?? 0}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">
                  Chat started
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {metrics?.funnel.chatStarted30d ?? 0}
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  {metrics?.funnel.onboardingToChatPercent ?? 0}%
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">
                  Conversation saved
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {metrics?.funnel.conversationSaved30d ?? 0}
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  {metrics?.funnel.chatToSavePercent ?? 0}%
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">
                  Checkout started
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {metrics?.funnel.checkoutStarted30d ?? 0}
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  {metrics?.funnel.saveToCheckoutPercent ?? 0}%
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-xs text-neutral-500">
                  Active Pro current
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {metrics?.funnel.activeProCurrent ?? 0}
                </div>
                <div className="mt-2 text-xs text-neutral-500">
                  {metrics?.funnel.checkoutToActiveProPercent ?? 0}%
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DropoffCard
              title="Onboarding done, but no chat"
              description="Users who completed onboarding in the last 30 days but never started a chat."
              group={
                metrics?.dropoffs.onboardingCompletedNoChat ?? {
                  count: 0,
                  sampleUserIds: [],
                }
              }
            />

            <DropoffCard
              title="Chat started, but no save"
              description="Users who started reflecting but never closed and saved a conversation."
              group={
                metrics?.dropoffs.chatStartedNoSave ?? {
                  count: 0,
                  sampleUserIds: [],
                }
              }
            />

            <DropoffCard
              title="Saved, but no checkout"
              description="Users who got value from the product but never started checkout."
              group={
                metrics?.dropoffs.conversationSavedNoCheckout ?? {
                  count: 0,
                  sampleUserIds: [],
                }
              }
            />

            <DropoffCard
              title="Checkout started, but no active Pro"
              description="Users who entered billing flow but do not currently have active Pro."
              group={
                metrics?.dropoffs.checkoutStartedNoActivePro ?? {
                  count: 0,
                  sampleUserIds: [],
                }
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-white">
                Journals daily · 30 days
              </div>
              <div className="mt-4">
                <Sparkline points={metrics?.trends.journalsDaily30d ?? []} />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-white">
                Saves daily · 30 days
              </div>
              <div className="mt-4">
                <Sparkline
                  points={metrics?.trends.conversationSavedDaily30d ?? []}
                />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-white">
                Checkouts daily · 30 days
              </div>
              <div className="mt-4">
                <Sparkline
                  points={metrics?.trends.checkoutStartedDaily30d ?? []}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-white">
                Conversion signals · last 7 days
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Checkout starts
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.analytics.conversionSignals.checkoutStarts7d ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Conversations saved
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.analytics.conversionSignals.conversationSaved7d ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Export opens
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.analytics.conversionSignals.exportOpened7d ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Chat limits hit
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.analytics.conversionSignals.chatLimitsHit7d ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-white">
                Billing states
              </div>

              <div className="mt-4 space-y-3">
                {orderedBillingStatuses.length === 0 ? (
                  <p className="text-sm text-neutral-500">
                    No billing state data yet.
                  </p>
                ) : (
                  orderedBillingStatuses.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                    >
                      <span className="text-sm capitalize text-neutral-300">
                        {key}
                      </span>
                      <span className="text-sm font-medium text-white">
                        {value}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-white">
                Saver activity buckets
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["D1", metrics?.retention.saversActiveBuckets.d1 ?? 0],
                  ["D3", metrics?.retention.saversActiveBuckets.d3 ?? 0],
                  ["D7", metrics?.retention.saversActiveBuckets.d7 ?? 0],
                  ["D14", metrics?.retention.saversActiveBuckets.d14 ?? 0],
                  ["D30", metrics?.retention.saversActiveBuckets.d30 ?? 0],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <div className="text-xs text-neutral-500">
                      {label} savers
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-white">
                Repeat saver depth · 30 days
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Users with 1+ saves
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.retention.repeatSavers30d.usersWith1Save ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Users with 2+ saves
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.retention.repeatSavers30d.usersWith2Saves ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Users with 3+ saves
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.retention.repeatSavers30d.usersWith3Saves ?? 0}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-xs text-neutral-500">
                    Users with 5+ saves
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {metrics?.retention.repeatSavers30d.usersWith5Saves ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white">
              Event counts · last 7 days
            </div>

            <div className="mt-4 space-y-3">
              {orderedEventCounts7d.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No analytics events yet.
                </p>
              ) : (
                orderedEventCounts7d.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="text-sm text-neutral-300">
                      {key}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {value}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white">
              Top savers
            </div>

            <div className="mt-4 space-y-3">
              {metrics?.retention.topSavers.length ? (
                metrics.retention.topSavers.map((row) => (
                  <div
                    key={row.user_id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="truncate text-sm text-neutral-300">
                      {row.user_id}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {row.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  No saver data yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-medium text-white">
              Recent events
            </div>

            <div className="mt-4 space-y-3">
              {metrics?.recentEvents?.length ? (
                metrics.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-medium text-white">
                        {event.event_name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-neutral-500">
                      User: {event.user_id}
                    </div>

                    {event.page && (
                      <div className="mt-1 text-xs text-neutral-500">
                        Page: {event.page}
                      </div>
                    )}

                    {event.metadata &&
                      Object.keys(event.metadata).length > 0 && (
                        <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs leading-relaxed text-neutral-300">
{JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  No recent events yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}