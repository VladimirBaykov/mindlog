import Link from "next/link";
import type { JournalSession } from "@/types/journal";

export default function JournalItem({ session }: { session: JournalSession }) {
  const date = new Date(session.createdAt).toLocaleDateString();

  const preview =
    session.messages.find((m) => m.role === "user")?.content.slice(0, 80) ||
    "Quiet moment";

  return (
    <Link
      href={`/journal/${session.id}`}
      className="block rounded-2xl border border-neutral-800 p-4 hover:bg-neutral-900 transition"
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm text-neutral-400">{date}</span>
        <span className="text-xs text-neutral-500">
          {session.finalState}
        </span>
      </div>

      <div className="text-sm text-neutral-200">
        {preview}
        {preview.length === 80 && "…"}
      </div>
    </Link>
  );
}
