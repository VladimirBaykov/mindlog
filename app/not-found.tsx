import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg">
            ⊘
          </div>

          <h1 className="mt-4 text-2xl font-semibold text-white">
            Page not found
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
            The page you tried to open does not exist, may have moved, or is
            no longer available.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/journal"
              className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
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
        </div>
      </div>
    </main>
  );
}