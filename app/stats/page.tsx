"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHeader } from "@/components/header/HeaderContext";
import { useJournal } from "@/components/journal/JournalContext";
import MoodChart from "./MoodChart";
import MoodTimeline from "./MoodTimeline";
import MoodStreak from "./MoodStreak";
import LockedFeatureCard from "@/components/ui/LockedFeatureCard";

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
          onClick: () => router.push("/chat"),
        },
        {
          label: "Profile",
          onClick: () => router.push("/profile"),
        },
        {
          label: "Upgrade",
          onClick: () => router.push("/upgrade"),
        },
      ],
    });

    return () => resetHeader();
  }, [router, setHeader, resetHeader]);

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

  const isPro = subscription?.isPro ?? false;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
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
            <p className="mt-4 text-sm leading-relaxed text-neutral-300">
              {weekly?.summary ||
                "No weekly reflection available yet."}
            </p>
          ) : (
            <div className="mt-4">
              <LockedFeatureCard
                title="Weekly reflection summary"
                description="Pro unlocks a 7-day reflective summary based on your recent journal activity, emotional patterns, and recurring themes."
              />
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
                insights.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-relaxed text-neutral-300"
                  >
                    {insight}
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">
                  No insights available yet.
                </p>
              )
            ) : (
              <LockedFeatureCard
                title="AI emotional pattern insights"
                description="Pro unlocks deeper emotional signals, recurring themes, and more meaningful reflection guidance generated from your journal history."
              />
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Recent streak
          </div>

          <div className="mt-4">
            <MoodStreak items={items} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Mood timeline
          </div>

          <div className="mt-4">
            <MoodTimeline items={items} />
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-5">
          <div className="text-sm font-medium text-white">
            Mood distribution
          </div>

          <div className="mt-4">
            <MoodChart items={items} />
          </div>
        </div>

        {!isPro && !loadingSubscription && (
          <>
            <LockedFeatureCard
              title="Deep emotional trends"
              description="Pro will unlock longer-range pattern detection, stronger summaries, and richer emotional analytics over time."
            />

            <LockedFeatureCard
              title="Export reflection reports"
              description="Pro will let users export personal summaries and journal analytics as polished downloadable reports."
            />
          </>
        )}
      </div>
    </div>
  );
}