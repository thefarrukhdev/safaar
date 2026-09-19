import { Skeleton } from "@/components/ui/Skeleton";
/**
 * Bron tasdiqi yuklanayotganda ko'rinadigan skeleton.
 */
export default function BookingDetailLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <Skeleton className="h-8 w-48 rounded" />
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-card p-6 shadow-sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-full animate-pulse rounded bg-slate-100"
          />
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-12 w-40 rounded-lg" />
        <Skeleton className="h-12 w-40 rounded-lg" />
      </div>
    </main>
  );
}
