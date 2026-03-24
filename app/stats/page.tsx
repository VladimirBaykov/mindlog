"use client";

import { useEffect, useMemo, useState } from "react";
import { useHeader } from "@/components/header/HeaderContext";
import { useJournal } from "@/components/journal/JournalContext";
import MoodChart from "./MoodChart";

type WeeklySummaryResponse = {
  summary: string;
  totalEntries: number;
  moods: Record<string, number>;
};

export default function StatsPage() {
  const { items } = useJournal();
  const { setHeader, resetHeader } = useHeader();

  const [weekly, setWeekly] =
    useState<WeeklySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHeader({
      title: "Reflection stats",
    });

    return () => resetHeader();
  }, [setHeader, resetHeader]);

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
      .finally(() => setLoading(false));
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
          <div className="text-sm font-medium text-white">
            Weekly reflection
          </div>

          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            {loading
              ? "Generating your weekly reflection..."
              : weekly?.summary ||
                "No weekly reflection available yet."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <div className="text-sm font-medium text-white">
            Mood distribution
          </div>

          <div className="mt-4">
            <MoodChart items={items} />
          </div>
        </div>
      </div>
    </div>
  );
}