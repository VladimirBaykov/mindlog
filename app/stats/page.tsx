"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHeader } from "@/components/header/HeaderContext";
import { useJournal } from "@/components/journal/JournalContext";
import MoodChart from "./MoodChart";
import MoodTimeline from "./MoodTimeline";
import MoodStreak from "./MoodStreak";
import LockedFeatureCard from "@/components/ui/LockedFeatureCard";
import { trackClientEvent } from "@/lib/analytics-client";

type WeeklySummaryResponse = {
  summary: string;
  totalEntries: number | null;
  moods: Record<string, number> | null;
  locked?: boolean;
  code?: string;
  feature?: string;
  upgradeUrl?: string;
};

type InsightsResponse = {
  insights: string[];
  locked?: boolean;
  code?: string;
  feature?: string;
  upgradeUrl?: string;
};

type SubscriptionResponse = {
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  isPro: boolean;
};

export default function StatsPage() {
  const router = useRouter();
  const { items } = useJournal();
  const { setHeader, resetHeader } = useHeader();

  const [subscription, setSubscription] =
    useState<SubscriptionResponse | null>(null);

  const [weekly, setWeekly] =
    useState<WeeklySummaryResponse | null>(null);
  const [insights, setInsights] =
    useState<InsightsResponse | null>(null);

  const [loadingSubscription, setLoadingSubscription] =
    useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [viewTracked, setViewTracked] = useState(false);

  useEffect(() => {
    setHeader({
      title: "Reflection stats",
      leftSlot: (
        <button
          onClick={() => router.push("/journal")}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          ← Journal
        </button>
      ),
      menuItems: [
        {
          label: "New conversation",
          onClick: async () => {
            await trackClientEvent({
              eventName: "stats_new_reflection_clicked",
              page: "/stats",
              metadata: {
                source: "header_menu",
                totalEntries: items.length,
                plan: subscription?.plan ?? null,
              },
            });

            router.push("/chat");
          },
        },
        {
          label: "Profile",
          onClick: () => router.push("/profile"),
        },
        {
          label: "Upgrade",
          onClick: async () => {
            await trackClientEvent({
              eventName: "stats_upgrade_clicked",
              page: "/stats",
              metadata: {
                source: "header_menu",
                totalEntries: items.length,
                plan: subscription?.plan ?? null,
              },
            });

            router.push("/upgrade");
          },
        },
      ],
    });

    return () => resetHeader();
  }, [router, setHeader, resetHeader, items.length, subscription?.plan]);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      try {
        setLoadingSubscription(true);

        const res = await fetch("/api/account/subscription", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to load subscription");
        }

        const data = (await res.json()) as SubscriptionResponse;

        if (!cancelled) {
          setSubscription(data);
        }
      } catch (error) {
        console.error("Subscription load error:", error);

        if (!cancelled) {
          setSubscription({
            plan: "free",
            status: "inactive",
            currentPeriodEnd: null,
            isPro: false,
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingSubscription(false);
        }
      }
    }

    loadSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewTracked) return;

    if (loadingSubscription) return;

    setViewTracked(true);

    trackClientEvent({
      eventName: "stats_viewed",
      page: "/stats",
      metadata: {
        totalEntries: items.length,
        plan: subscription?.plan ?? null,
        isPro: Boolean(subscription?.isPro),
      },
    });
  }, [viewTracked, loadingSubscription, items.length, subscription]);

  useEffect(() => {
    if (loadingSubscription || !subscription?.isPro) {
      return;
    }

    let cancelled = false;

    async function loadWeekly() {
      try {
        setLoadingWeekly(true);

        const res = await fetch("/api/stats/weekly-summary", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!cancelled) {
          setWeekly(data);
        }

        if (!res.ok && res.status !== 403) {
          throw new Error("Failed to load weekly summary");
        }
      } catch (err) {
        console.error("Stats load error:", err);
      } finally {
        if (!cancelled) {
          setLoadingWeekly(false);
        }
      }
    }

    loadWeekly();

    return () => {
      cancelled = true;
    };
  }, [loadingSubscription, subscription?.isPro]);

  useEffect(() => {
    if (loadingSubscription || !subscription?.isPro) {
      return;
    }

    let cancelled = false;

    async function loadInsights() {
      try {
        setLoadingInsights(true);

        const res = await fetch("/api/stats/insights", {
          cache: "no-store",
        });

        const data = await res.json();

        if (!cancelled) {
          setInsights(data);
        }

        if (!res.ok && res.status !== 403) {
          throw new Error("Failed to load insights");
        }
      } catch (err) {
        console.error("Insights load error:", err);
      } finally {
        if (!cancelled) {
          setLoadingInsights(false);
        }
      }
    }

    loadInsights();

    return () => {
      cancelled = true;
    };
  }, [loadingSubscription, subscription?.isPro]);

  const totalEntries = items.length;

  const mostCommonMood = useMemo(() => {
    const counts = items.reduce<Record<string, number>>(
      (acc, item) => {
        const mood = item.mood || "unknown";
        acc[mood] = (acc[mood] || 0) + 1;
        return acc;
      },
      {}
    );

    const sorted = Object.entries(counts).sort(
      (a, b) => b[1] - a[1]
    );

    return sorted[0]?.[0] || "No data";
  }, [items]);

  const lastEntryDate = useMemo(() => {
    if (!items.length) return "No entries yet";
    return new Date(items[0].createdAt).toLocaleDateString();
  }, [items]);

  const entriesThisWeek = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      const created = new Date(item.createdAt).getTime();
      return now - created <= sevenDays;
    }).length;
  }, [items]);

  const recentMomentum = useMemo(() => {
    if (entriesThisWeek === 0) return "No reflections this week yet";
    if (entriesThisWeek === 1) return "1 reflection this week";
    return `${entriesThisWeek} reflections this week`;
  }, [entriesThisWeek]);

  const isPro = subscription?.isPro ?? false;

  const milestoneLabel = useMemo(() => {
    if (totalEntries === 0) return "Start with your first entry";
    if (totalEntries < 3) return "You’re building early momentum";
    if (totalEntries < 7) return "A pattern is starting to form";
    if (totalEntries < 15) return "Your reflection history is growing";
    return "You’ve built a meaningful reflection archive";
  }, [totalEntries]);

  const statsValueCopy = useMemo(() => {
    if (totalEntries === 0) {
      return "Your stats become useful once you begin saving reflections.";
    }

    if (totalEntries < 3) {
      return "You are still in the early stage, but even a few entries begin to create emotional contrast over time.";
    }

    if (totalEntries < 8) {
      return "You now have enough history for recurring moods and rhythms to start feeling real.";
    }

    return "Your journal is now deep enough that reflection stats can help you see patterns instead of isolated moments.";
  }, [totalEntries]);

  const nextStepCopy = useMemo(() => {
    if (isPro) {
      return "Use your stats as a reflection mirror: review patterns, open recent entries, and keep building continuity.";
    }

    return "Keep saving reflections to strengthen your stats, or upgrade to unlock richer summaries and deeper AI pattern detection.";
  }, [isPro]);

  if (!items.length) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
              ◌
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-white">
              Your stats will grow with your journal
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
              Save your first reflection to unlock mood trends, streaks,
              and early signals about your inner patterns.
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                onClick={async () => {
                  await trackClientEvent({
                    eventName: "stats_new_reflection_clicked",
                    page: "/stats",
                    metadata: {
                      source: "empty_state",
                      totalEntries: 0,
                      plan: subscription?.plan ?? null,
                    },
                  });

                  router.push("/chat");
                }}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Start first reflection
              </button>

              <button
                onClick={() => router.push("/journal")}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
              >
                Go to journal
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Mood distribution
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                See which emotional tones show up most often over time.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                Reflection streaks
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                Build a calmer rhythm by returning to reflection
                regularly.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <div className="text-sm font-medium text-white">
                AI insight layer
              </div>
              <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                Pro unlocks deeper summaries and stronger emotional
                pattern detection.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            Reflection progress
          </div>

          <div className="mt-3 text-lg font-medium text-white">
            {milestoneLabel}
          </div>

          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            {statsValueCopy}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Last entry
              </div>
              <div className="mt-2 text-base font-medium text-white">
                {lastEntryDate}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                Weekly momentum
              </div>
              <div className="mt-2 text-base font-medium text-white">
                {recentMomentum}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-xs text-neutral-500">
              Total entries
            </div>
            <div className="mt-2 text-3xl font-semibold text-white">
              {totalEntries}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
            <div className="text-xs text-neutral-500">
              Top mood
            </div>
            <div className="mt-2 text-3xl font-semibold capitalize text-white">
              {mostCommonMood}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-white">
              Weekly reflection
            </div>
            <div className="text-xs text-neutral-500">
              Last entry: {lastEntryDate}
            </div>
          </div>

          {loadingSubscription || loadingWeekly ? (
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              Generating your weekly reflection...
            </p>
          ) : isPro ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
              <p className="text-sm leading-relaxed text-neutral-200">
                {weekly?.summary ||
                  "No weekly reflection available yet."}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <LockedFeatureCard
                title="Weekly reflection summary"
                description="Pro unlocks a 7-day reflective summary based on your recent journal activity, emotional patterns, and recurring themes."
              />

              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <div className="text-sm font-medium text-white">
                  Why this matters
                </div>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  Weekly summaries make your journal feel cumulative,
                  not fragmented. They help connect separate reflections
                  into a bigger emotional picture.
                </p>

                <button
                  onClick={async () => {
                    await trackClientEvent({
                      eventName: "stats_upgrade_clicked",
                      page: "/stats",
                      metadata: {
                        source: "weekly_summary_lock",
                        totalEntries,
                        plan: subscription?.plan ?? null,
                      },
                    });

                    router.push("/upgrade");
                  }}
                  className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                >
                  Unlock weekly reflection
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Pattern insights
          </div>

          <div className="mt-4 space-y-3">
            {loadingSubscription || loadingInsights ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4"
                  >
                    <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.05]" />
                    <div className="mt-2 h-3 w-4/5 animate-pulse rounded-full bg-white/[0.05]" />
                  </div>
                ))}
              </div>
            ) : isPro ? (
              insights?.insights?.length ? (
                <div className="space-y-3">
                  {insights.insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-relaxed text-neutral-300"
                    >
                      {insight}
                    </div>
                  ))}

                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                    <div className="text-sm font-medium text-white">
                      Keep building context
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                      The stronger your journal history becomes, the more
                      meaningful these insights can feel.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  No insights available yet.
                </p>
              )
            ) : (
              <div className="space-y-4">
                <LockedFeatureCard
                  title="AI emotional pattern insights"
                  description="Pro unlocks deeper emotional signals, recurring themes, and more meaningful reflection guidance generated from your journal history."
                />

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-sm font-medium text-white">
                    What Pro adds
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                    Instead of only seeing counts and charts, Pro helps
                    turn your reflection history into narrative meaning.
                  </p>

                  <button
                    onClick={async () => {
                      await trackClientEvent({
                        eventName: "stats_upgrade_clicked",
                        page: "/stats",
                        metadata: {
                          source: "insights_lock",
                          totalEntries,
                          plan: subscription?.plan ?? null,
                        },
                      });

                      router.push("/upgrade");
                    }}
                    className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:opacity-90"
                  >
                    Unlock pattern insights
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Recent streak
          </div>

          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            This shows how steadily you’ve been returning to reflection.
          </p>

          <div className="mt-4">
            <MoodStreak items={items} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Mood timeline
          </div>

          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            A timeline helps you notice movement, not just isolated mood
            labels.
          </p>

          <div className="mt-4">
            <MoodTimeline items={items} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Mood distribution
          </div>

          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            Your top mood doesn’t define you, but it can reveal what has
            been most present lately.
          </p>

          <div className="mt-4">
            <MoodChart items={items} />
          </div>
        </div>

        {!isPro && !loadingSubscription && (
          <>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
              <div className="text-sm font-medium text-white">
                Free plan progress
              </div>

              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                Your stats are already useful, but Pro turns them into a
                deeper reflective layer with summaries, insights, export,
                and stronger emotional pattern detection.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-sm font-medium text-white">
                    Deep emotional trends
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                    Longer-range pattern detection over time.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                  <div className="text-sm font-medium text-white">
                    Export reflection reports
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                    Save personal summaries and journal analytics as
                    polished reports.
                  </p>
                </div>
              </div>

              <button
                onClick={async () => {
                  await trackClientEvent({
                    eventName: "stats_upgrade_clicked",
                    page: "/stats",
                    metadata: {
                      source: "bottom_payoff_block",
                      totalEntries,
                      plan: subscription?.plan ?? null,
                    },
                  });

                  router.push("/upgrade");
                }}
                className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
              >
                Upgrade to Pro
              </button>
            </div>
          </>
        )}

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            What to do next
          </div>

          <p className="mt-2 text-sm leading-relaxed text-neutral-400">
            {nextStepCopy}
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={async () => {
                await trackClientEvent({
                  eventName: "stats_new_reflection_clicked",
                  page: "/stats",
                  metadata: {
                    source: "bottom_cta",
                    totalEntries,
                    plan: subscription?.plan ?? null,
                  },
                });

                router.push("/chat");
              }}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Start another reflection
            </button>

            <button
              onClick={() => router.push("/journal")}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
            >
              Open journal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}