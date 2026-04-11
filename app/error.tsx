"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("ROUTE ERROR:", error);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
            !
          </div>

          <h1 className="mt-4 text-2xl font-semibold text-white">
            This page hit a problem
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            Something went wrong while loading this part of MindLog.
            Try again or return to a stable page.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={reset}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Try again
            </button>

            <Link
              href="/journal"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
            >
              Open journal
            </Link>

            <Link
              href="/profile"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
            >
              Go to profile
            </Link>
          </div>

          {error?.digest && (
            <p className="mt-5 text-xs text-neutral-500">
              Error reference: {error.digest}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}