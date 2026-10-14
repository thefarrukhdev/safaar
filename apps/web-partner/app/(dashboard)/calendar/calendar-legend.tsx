"use client";

import { Info, MousePointerClick } from "lucide-react";

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs text-[var(--muted-foreground)] px-1">
      {/* Status belgilari */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="h-3 w-3 rounded-sm bg-brand-500 shadow-xs" aria-hidden="true" />
          Tasdiqlangan
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="h-3 w-3 rounded-sm bg-accent-500 shadow-xs" aria-hidden="true" />
          Band (ichkarida)
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="h-3 w-3 rounded-sm bg-amber-400 shadow-xs" aria-hidden="true" />
          Tasdiq kutmoqda
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="h-3 w-3 rounded-sm bg-zinc-400 shadow-xs" aria-hidden="true" />
          Yakunlangan
        </span>
      </div>

      {/* Operatsion qo'llanma */}
      <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-1">
          <MousePointerClick className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          Bo'sh katak: yangi bron yaratish
        </span>
        <span className="hidden sm:inline-flex items-center gap-1 opacity-70">
          <Info className="h-3 w-3" aria-hidden="true" />
          Bron ustiga bosib boshqaring
        </span>
      </div>
    </div>
  );
}
