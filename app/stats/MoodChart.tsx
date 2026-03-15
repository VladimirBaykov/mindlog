"use client";

import { JournalItem } from "@/components/journal/JournalContext";

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

  const max = Math.max(...Object.values(moodCount), 1);

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ marginBottom: 20 }}>
        Mood Distribution
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 20,
          height: 200,
        }}
      >
        {Object.entries(moodCount).map(
          ([mood, count]) => {
            const height =
              (count / max) * 100;

            return (
              <div
                key={mood}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${height}%`,
                    background:
                      "linear-gradient(180deg, #4f46e5, #6366f1)",
                    borderRadius: 12,
                    transition:
                      "height 0.4s ease",
                  }}
                />

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                  }}
                >
                  {mood}
                </div>

                <div
                  style={{
                    fontWeight: 600,
                    marginTop: 4,
                  }}
                >
                  {count}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
