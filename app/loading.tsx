export default function AppLoading() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-6 pt-24 pb-24">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-8">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300">
            Loading
          </div>

          <div className="mt-5 h-8 w-48 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-white/[0.05]" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-white/[0.05]" />

          <div className="mt-8 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4"
              >
                <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-white/[0.05]" />
                <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-white/[0.05]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}