export function JournalSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl bg-neutral-900 px-4 py-3 space-y-2"
        >
          <div className="h-4 w-2/3 rounded shimmer" />
          <div className="h-3 w-1/3 rounded shimmer" />
        </div>
      ))}
    </div>
  );
}
