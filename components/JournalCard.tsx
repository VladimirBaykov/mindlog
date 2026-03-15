import { moodConfig, Mood } from "@/lib/journal/moodMap";

type Props = {
  summary: string;
  mood: Mood;
  createdAt: string;
  onClick?: () => void;
};

export function JournalCard({
  summary,
  mood,
  createdAt,
  onClick,
}: Props) {
  const config = moodConfig[mood] ?? moodConfig.calm;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-neutral-800
                 bg-neutral-900 px-4 py-3
                 hover:bg-neutral-800 transition"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">
          {summary || "Conversation"}
        </h3>

        <span className="text-xs opacity-70">
          {config.dot}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
        <span
          className={`h-2 w-2 rounded-full ${config.color}`}
        />
        <span>{config.label}</span>
        <span>·</span>
        <span>
          {new Date(createdAt).toLocaleDateString()}
        </span>
      </div>
    </button>
  );
}