export function JournalSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-white/6 bg-neutral-900/70 px-4 py-4"
        >
          <div className="space-y-3">
            <div className="h-4 w-2/3 rounded-full bg-white/[0.08] animate-pulse" />
            <div className="h-3 w-full rounded-full bg-white/[0.05] animate-pulse" />
            <div className="h-3 w-4/5 rounded-full bg-white/[0.05] animate-pulse" />

            <div className="pt-1 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-white/[0.08] animate-pulse" />
              <div className="h-3 w-16 rounded-full bg-white/[0.05] animate-pulse" />
              <div className="h-3 w-10 rounded-full bg-white/[0.05] animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}