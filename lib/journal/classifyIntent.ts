export type IntentResult = {
  type: "chat" | "journal";
  confidence: number;
};

export function classifyIntent(text: string): IntentResult {
  const journalSignals = [
    "today",
    "i feel",
    "i felt",
    "this morning",
    "this evening",
    "lately",
    "these days",
    "i keep thinking",
    "i noticed",
    "i realized",
  ];

  const lowered = text.toLowerCase();

  const score = journalSignals.filter((signal) =>
    lowered.includes(signal)
  ).length;

  if (score >= 2) {
    return { type: "journal", confidence: Math.min(90, 50 + score * 10) };
  }

  return { type: "chat", confidence: 60 };
}
