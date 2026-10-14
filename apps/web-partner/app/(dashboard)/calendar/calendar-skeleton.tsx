"use client";

import { Skeleton } from "../../_components/ui/skeleton";

export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* KPI Stats skeleton */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xs"
          >
            <div className="flex items-start justify-between">
              <div>
                <Skeleton className="h-3 w-24 mb-3" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters toolbar skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs">
        <Skeleton className="h-9 w-48 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Grid table skeleton */}
      <div className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
        <div className="flex gap-2 border-b border-[var(--border)] pb-3">
          <Skeleton className="h-10 w-40 shrink-0 rounded-md" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 flex-1 rounded-md" />
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Skeleton className="h-14 w-40 shrink-0 rounded-md" />
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-14 flex-1 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
