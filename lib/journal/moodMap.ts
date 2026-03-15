export type Mood =
  | "calm"
  | "reflective"
  | "heavy"
  | "anxious"
  | "hopeful";

export const moodConfig: Record<
  Mood,
  {
    label: string;
    color: string;
    dot: string;
  }
> = {
  calm: {
    label: "Calm",
    color: "bg-emerald-500",
    dot: "🟢",
  },
  reflective: {
    label: "Reflective",
    color: "bg-blue-500",
    dot: "🔵",
  },
  heavy: {
    label: "Heavy",
    color: "bg-purple-500",
    dot: "🟣",
  },
  anxious: {
    label: "Anxious",
    color: "bg-amber-500",
    dot: "🟡",
  },
  hopeful: {
    label: "Hopeful",
    color: "bg-sky-400",
    dot: "🌤️",
  },
};