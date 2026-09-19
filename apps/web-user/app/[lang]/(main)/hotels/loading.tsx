import { Skeleton } from "@/components/ui/Skeleton";
/**
 * Natijalar sahifasi yuklanayotganda darhol ko'rinadigan skeleton (CWV uchun).
 * Layout darhol chiqadi, ma'lumot kelguncha shu fallback ko'rsatiladi.
 */
export default function HotelsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      {/* Search Bar / Header Skeleton */}
      <Skeleton className="h-24 rounded-xl" />
      
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters Sidebar Skeleton */}
        <Skeleton className="hidden lg:block h-[600px] rounded-xl border border-slate-200 dark:border-slate-800" />
        
        {/* Hotel Cards Grid Skeleton */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-5 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
                
                <div className="mt-4 flex items-center justify-between">
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-6 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
