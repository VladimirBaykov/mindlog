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
