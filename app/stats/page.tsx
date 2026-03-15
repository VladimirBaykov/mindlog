"use client";

import { useJournal } from "@/components/journal/JournalContext";
import MoodChart from "@/components/stats/MoodChart";

export default function StatsPage() {
  const { items } = useJournal();

  const total = items.length;

  return (
    <div style={{ padding: 40 }}>
      <h1>Mood Analytics</h1>

      <p>Total entries: {total}</p>

      <MoodChart items={items} />
    </div>
  );
}
