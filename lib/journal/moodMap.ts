export type Mood =
  | "calm"
  | "reflective"
  | "heavy"
  | "anxious"
  | "hopeful"
  | "happy"
  | "sad"
  | "excited"
  | "confused"
  | "casual";

export const moodConfig: Record<
  Mood,
  {
    label: string;
    color: string;
    stripe: string;
    softBg: string;
    dot: string;
  }
> = {
  calm: {
    label: "Calm",
    color: "bg-emerald-300/75",
    stripe: "bg-emerald-400",
    softBg: "bg-emerald-400/10",
    dot: "●",
  },
  reflective: {
    label: "Reflective",
    color: "bg-sky-300/70",
    stripe: "bg-sky-400",
    softBg: "bg-sky-400/10",
    dot: "●",
  },
  heavy: {
    label: "Heavy",
    color: "bg-violet-300/70",
    stripe: "bg-violet-400",
    softBg: "bg-violet-400/10",
    dot: "●",
  },
  anxious: {
    label: "Anxious",
    color: "bg-amber-300/75",
    stripe: "bg-amber-400",
    softBg: "bg-amber-400/10",
    dot: "●",
  },
  hopeful: {
    label: "Hopeful",
    color: "bg-cyan-200/80",
    stripe: "bg-cyan-300",
    softBg: "bg-cyan-300/10",
    dot: "●",
  },
  happy: {
    label: "Happy",
    color: "bg-lime-300/80",
    stripe: "bg-lime-300",
    softBg: "bg-lime-300/10",
    dot: "●",
  },
  sad: {
    label: "Sad",
    color: "bg-indigo-300/75",
    stripe: "bg-indigo-400",
    softBg: "bg-indigo-400/10",
    dot: "●",
  },
  excited: {
    label: "Excited",
    color: "bg-rose-300/80",
    stripe: "bg-rose-400",
    softBg: "bg-rose-400/10",
    dot: "●",
  },
  confused: {
    label: "Confused",
    color: "bg-orange-300/80",
    stripe: "bg-orange-400",
    softBg: "bg-orange-400/10",
    dot: "●",
  },
  casual: {
    label: "Casual",
    color: "bg-slate-300/70",
    stripe: "bg-slate-300",
    softBg: "bg-slate-300/10",
    dot: "●",
  },
};
