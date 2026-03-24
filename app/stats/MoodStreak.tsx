"use client";

import { JournalItem } from "@/components/journal/JournalContext";
import { moodConfig } from "@/lib/journal/moodMap";

type Props = {
  items: JournalItem[];
};

type DayEntry = {
  dateKey: string;
  label: string;
  hasEntry: boolean;
  mood: string;
};

const moodPriority = [
  "hopeful",
  "calm",
  "reflective",
  "anxious",
  "heavy",
  "unknown",
];

function getDominantMood(moods: string[]) {
  const counts = moods.reduce<Record<string, number>>((acc, mood) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return moodPriority.indexOf(a[0]) - moodPriority.indexOf(b[0]);
  });

  return sorted[0]?.[0] || "unknown";
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function MoodStreak({ items }: Props) {
  const days: DayEntry[] = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));

    const dateKey = getDateKey(date);

    const dayItems = items.filter((item) => {
      const itemDate = getDateKey(new Date(item.createdAt));
      return itemDate === dateKey;
    });

    const moods = dayItems.map((item) => item.mood || "unknown");
    const dominantMood =
      dayItems.length > 0 ? getDominantMood(moods) : "unknown";

    return {
      dateKey,
      label: date.toLocaleDateString(undefined, {
        weekday: "short",
      }),
      hasEntry: dayItems.length > 0,
      mood: dominantMood,
    };
  });

  let streak = 0;

  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].hasEntry) {
      streak += 1;
    } else {
      break;
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
        <div className="text-xs text-neutral-500">
          Current reflection streak
        </div>
        <div className="mt-2 text-2xl font-semibold text-white">
          {streak} day{streak === 1 ? "" : "s"}
        </div>
      </div>

      <div>
        <div className="mb-3 text-xs text-neutral-500">
          Last 7 days
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const moodMeta =
              day.mood in moodConfig
                ? moodConfig[day.mood as keyof typeof moodConfig]
                : null;

            return (
              <div
                key={day.dateKey}
                className={`rounded-xl border px-2 py-3 text-center ${
                  day.hasEntry
                    ? "border-white/10 bg-white/[0.04]"
                    : "border-white/6 bg-white/[0.015]"
                }`}
              >
                <div className="text-[11px] text-neutral-500">
                  {day.label}
                </div>

                <div className="mt-2 flex justify-center">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      day.hasEntry
                        ? moodMeta?.color || "bg-neutral-500"
                        : "bg-neutral-700"
                    }`}
                  />
                </div>

                <div className="mt-2 text-[11px] text-neutral-400 capitalize">
                  {day.hasEntry
                    ? moodMeta?.label || day.mood
                    : "No entry"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}