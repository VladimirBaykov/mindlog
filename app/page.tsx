"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-between px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-white/90">
            MindLog
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/sign-in"
              className="text-neutral-400 transition hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-full bg-white px-4 py-2 font-medium text-black transition hover:opacity-90"
            >
              Sign up
            </Link>
          </div>
        </div>

        <div className="py-12">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
            Reflective AI journal
          </div>

          <h1 className="mt-6 max-w-lg text-4xl font-semibold leading-tight sm:text-5xl">
            A calmer way to talk,
            <br />
            reflect, and understand
            <br />
            your inner patterns.
          </h1>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-neutral-400 sm:text-base">
            MindLog turns private conversations into meaningful journal
            entries, mood patterns, and gentle weekly reflections.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Start free
            </Link>

            <Link
              href="/sign-in"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.05]"
            >
              I already have an account
            </Link>
          </div>
        </div>

        <div className="grid gap-3 pb-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Reflective chat
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              Talk naturally and let the app help you process what matters.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Mood patterns
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              Track emotional themes over time with simple, private analytics.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-sm font-medium text-white">
              Weekly insight
            </div>
            <p className="mt-2 text-xs leading-relaxed text-neutral-400">
              Get gentle summaries and signals from your recent reflections.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}