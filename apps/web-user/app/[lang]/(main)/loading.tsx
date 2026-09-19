export default function Loading() {
  return (
    <div className="flex flex-col w-full min-h-svh">
      {/* Hero Skeleton */}
      <div className="h-[60vh] w-full bg-slate-200 animate-pulse rounded-none" />

      {/* Stats Skeleton */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded-lg mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-slate-200 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
