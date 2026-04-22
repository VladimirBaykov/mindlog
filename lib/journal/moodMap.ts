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
    color: "bg-emerald-300/75",
    dot: "●",
  },
  reflective: {
    label: "Reflective",
    color: "bg-sky-300/70",
    dot: "●",
  },
  heavy: {
    label: "Heavy",
    color: "bg-violet-300/70",
    dot: "●",
  },
  anxious: {
    label: "Anxious",
    color: "bg-amber-300/75",
    dot: "●",
  },
  hopeful: {
    label: "Hopeful",
    color: "bg-cyan-200/80",
    dot: "●",
  },
};