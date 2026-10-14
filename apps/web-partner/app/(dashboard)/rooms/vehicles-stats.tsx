"use client";

import { CarFront, CheckCircle2, PauseCircle } from "lucide-react";
import { cn } from "../../_lib/utils/cn";
import type { VehicleMetrics, VehicleStatusFilter } from "./vehicles-types";

interface VehiclesStatsProps {
  metrics: VehicleMetrics;
  selectedStatus: VehicleStatusFilter;
  onSelectStatus: (status: VehicleStatusFilter) => void;
}

export function VehiclesStats({
  metrics,
  selectedStatus,
  onSelectStatus,
}: VehiclesStatsProps) {
  if (metrics.total === 0) return null;

  return (
    <section aria-label="Avtomobillar operatsion statistikasi" className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Jami avtomobillar */}
        <button
          type="button"
          onClick={() => onSelectStatus("all")}
          aria-pressed={selectedStatus === "all"}
          className={cn(
            "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer shadow-xs",
            selectedStatus === "all"
              ? "border-brand-500/60 bg-brand-50/50 shadow-sm ring-2 ring-brand-500/30 dark:border-brand-500/40 dark:bg-brand-950/25"
              : "border-zinc-200/80 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
          )}
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Jami avtomobillar
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 transition-transform group-hover:scale-105">
              <CarFront className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {metrics.total}
            </span>
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              ta transport
            </span>
          </div>
        </button>

        {/* Faol (Sotuvda) */}
        <button
          type="button"
          onClick={() => onSelectStatus(selectedStatus === "active" ? "all" : "active")}
          aria-pressed={selectedStatus === "active"}
          className={cn(
            "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer shadow-xs",
            selectedStatus === "active"
              ? "border-emerald-500/60 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-500/30 dark:border-emerald-500/40 dark:bg-emerald-950/25"
              : "border-zinc-200/80 bg-white hover:border-emerald-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
          )}
        >
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Faol (Sotuvda)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 transition-transform group-hover:scale-105">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
              {metrics.active}
            </span>
            <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-500/80">
              sotuvda ochiq
            </span>
          </div>
        </button>

        {/* Nofaol (Yopiq) */}
        <button
          type="button"
          onClick={() => onSelectStatus(selectedStatus === "inactive" ? "all" : "inactive")}
          aria-pressed={selectedStatus === "inactive"}
          className={cn(
            "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer shadow-xs",
            selectedStatus === "inactive"
              ? "border-amber-500/60 bg-amber-50/60 shadow-sm ring-2 ring-amber-500/30 dark:border-amber-500/40 dark:bg-amber-950/25"
              : "border-zinc-200/80 bg-white hover:border-amber-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
          )}
        >
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Nofaol (Yopiq)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 transition-transform group-hover:scale-105">
              <PauseCircle className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-700 dark:text-zinc-300">
              {metrics.inactive}
            </span>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              sotuv to'xtatilgan
            </span>
          </div>
        </button>
      </div>

      {/* Park faollik darajasi info bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Parkning sotuvga tayyorlik darajasi:
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {metrics.activeRate}%
          </span>
          <span className="hidden sm:inline text-xs text-zinc-400 dark:text-zinc-500">
            ({metrics.active} ta faol / {metrics.total} ta jami)
          </span>
        </div>

        <div className="w-32 sm:w-44 bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
            style={{ width: `${metrics.activeRate}%` }}
          />
        </div>
      </div>
    </section>
  );
}
