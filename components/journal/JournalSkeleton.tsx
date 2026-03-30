export function JournalSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-white/6 bg-neutral-900/70 px-4 py-4"
        >
          <div className="space-y-3">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.05]" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/[0.05]" />

            <div className="flex items-center gap-2 pt-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-white/[0.08]" />
              <div className="h-3 w-16 animate-pulse rounded-full bg-white/[0.05]" />
              <div className="h-3 w-10 animate-pulse rounded-full bg-white/[0.05]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}