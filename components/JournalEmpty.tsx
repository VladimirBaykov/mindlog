import Link from "next/link";

export default function JournalEmpty() {
  return (
    <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
        ✦
      </div>

      <h2 className="mt-4 text-lg font-medium text-white">
        Your journal is still quiet
      </h2>

      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">
        Start a conversation and close it when you’re done. MindLog will save
        it here as a private reflection entry.
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/chat"
          className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
        >
          Start a new conversation
        </Link>

        <Link
          href="/stats"
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
        >
          View reflection stats
        </Link>
      </div>
    </div>
  );
}