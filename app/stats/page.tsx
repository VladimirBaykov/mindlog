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
  totalEntries: number;
  moods: Record<string, number>;
};

type InsightsResponse = {
  insights: string[];
};

export default function StatsPage() {
  const router = useRouter();
  const { items } = useJournal();
  const { setHeader, resetHeader } = useHeader();

  const [weekly, setWeekly] =
    useState<WeeklySummaryResponse | null>(null);
  const [insights, setInsights] =
    useState<InsightsResponse | null>(null);

  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [loadingInsights, setLoadingInsights] =
    useState(true);

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
          onClick: () => router.push("/"),
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
    fetch("/api/stats/weekly-summary")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => setWeekly(data))
      .catch((err) => {
        console.error("Stats load error:", err);
      })
      .finally(() => setLoadingWeekly(false));
  }, []);

  useEffect(() => {
    fetch("/api/stats/insights")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => setInsights(data))
      .catch((err) => {
        console.error("Insights load error:", err);
      })
      .finally(() => setLoadingInsights(false));
  }, []);

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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 pt-24 pb-24 space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-neutral-500">
              Total entries
            </div>
            <div className="mt-2 text-2xl font-semibold">
              {totalEntries}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-xs text-neutral-500">
              Top mood
            </div>
            <div className="mt-2 text-2xl font-semibold capitalize">
              {mostCommonMood}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">
              Weekly reflection
            </div>
            <div className="text-xs text-neutral-500">
              Last entry: {lastEntryDate}
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            {loadingWeekly
              ? "Generating your weekly reflection..."
              : weekly?.summary ||
                "No weekly reflection available yet."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="text-sm font-medium text-white">
            Pattern insights
          </div>

          <div className="mt-4 space-y-3">
            {loadingInsights ? (
              <p className="text-sm text-neutral-400">
                Generating insights...
              </p>
            ) : insights?.insights?.length ? (
              insights.insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-neutral-300"
                >
                  {insight}
                </div>
              ))
            ) : (
              <p className="text-sm text-neutral-500">
                No insights available yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="text-sm font-medium text-white">
            Recent streak
          </div>

          <div className="mt-4">
            <MoodStreak items={items} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="text-sm font-medium text-white">
            Mood timeline
          </div>

          <div className="mt-4">
            <MoodTimeline items={items} />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="text-sm font-medium text-white">
            Mood distribution
          </div>

          <div className="mt-4">
            <MoodChart items={items} />
          </div>
        </div>

        <LockedFeatureCard
          title="Deep emotional trends"
          description="Pro will unlock longer-range pattern detection, stronger summaries, and richer emotional analytics over time."
        />

        <LockedFeatureCard
          title="Export reflection reports"
          description="Pro will let users export personal summaries and journal analytics as polished downloadable reports."
        />
      </div>
    </div>
  );
}