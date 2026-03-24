"use client";

import { JournalItem } from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";

type Props = {
  items: JournalItem[];
};

type DayPoint = {
  dateKey: string;
  label: string;
  mood: string;
  count: number;
};

const fallbackMoodOrder = [
  "calm",
  "reflective",
  "hopeful",
  "anxious",
  "heavy",
  "unknown",
];

function getMoodScore(mood: string) {
  switch (mood) {
    case "heavy":
      return 1;
    case "anxious":
      return 2;
    case "reflective":
      return 3;
    case "calm":
      return 4;
    case "hopeful":
      return 5;
    default:
      return 3;
  }
}

function getDominantMood(moods: string[]) {
  const counts = moods.reduce<Record<string, number>>((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (
      fallbackMoodOrder.indexOf(a[0]) -
      fallbackMoodOrder.indexOf(b[0])
    );
  });

  return sorted[0]?.[0] || "unknown";
}

export default function MoodTimeline({ items }: Props) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
    });

    return {
      dateKey: key,
      label,
    };
  });

  const points: DayPoint[] = last7Days.map((day) => {
    const dayItems = items.filter((item) => {
      const date = new Date(item.createdAt)
        .toISOString()
        .slice(0, 10);
      return date === day.dateKey;
    });

    const moods = dayItems.map((item) => item.mood || "unknown");
    const dominantMood =
      dayItems.length > 0
        ? getDominantMood(moods)
        : "unknown";

    return {
      dateKey: day.dateKey,
      label: day.label,
      mood: dominantMood,
      count: dayItems.length,
    };
  });

  const values = points.map((p) => getMoodScore(p.mood));
  const max = 5;
  const min = 1;

  if (items.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        No timeline data yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex h-36 items-end gap-2">
        {points.map((point) => {
          const score = getMoodScore(point.mood);
          const heightPercent =
            ((score - min + 1) / (max - min + 1)) * 100;

          const moodMeta =
            point.mood in moodConfig
              ? moodConfig[point.mood as keyof typeof moodConfig]
              : null;

          return (
            <div
              key={point.dateKey}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-xl bg-white/70 transition-all duration-500"
                  style={{
                    height: `${heightPercent}%`,
                    opacity: point.count > 0 ? 1 : 0.18,
                  }}
                  title={`${point.label}: ${point.mood} (${point.count} entries)`}
                />
              </div>

              <div className="flex flex-col items-center gap-1">
                <span
                  className={`h-2 w-2 rounded-full ${
                    moodMeta?.color || "bg-neutral-500"
                  }`}
                />
                <span className="text-[11px] text-neutral-500">
                  {point.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-500">
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
          Higher bars = lighter / steadier mood
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
          Faded bars = no entries that day
        </div>
      </div>
    </div>
  );
}