"use client";

import { JournalItem } from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";

type Props = {
  items: JournalItem[];
};

export default function MoodChart({ items }: Props) {
  const moodCount = items.reduce(
    (acc: Record<string, number>, item) => {
      const mood = item.mood || "unknown";
      acc[mood] = (acc[mood] || 0) + 1;
      return acc;
    },
    {}
  );

  const entries = Object.entries(moodCount);
  const max = Math.max(...Object.values(moodCount), 1);

  if (entries.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        No mood data yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map(([mood, count]) => {
        const width = `${(count / max) * 100}%`;
        const moodMeta =
          mood in moodConfig
            ? moodConfig[mood as keyof typeof moodConfig]
            : null;

        return (
          <div key={mood} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="capitalize text-neutral-300">
                {moodMeta?.label || mood}
              </span>
              <span className="text-neutral-500">{count}</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-white/70 transition-all duration-500"
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}