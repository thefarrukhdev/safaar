"use client";

import { CheckCircle2, AlertTriangle, Users, Wrench, Building2 } from "lucide-react";
import { RoomStatus } from "../../_lib/domain/types";
import { OccupancyMeter } from "../../_components/domain/occupancy-meter";
import { cn } from "../../_lib/utils/cn";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { RoomMetrics } from "./types";

interface RoomsStatsProps {
  metrics: RoomMetrics;
  selectedStatus: RoomStatus | "all";
  onSelectStatus: (status: RoomStatus | "all") => void;
  unitPlural: string;
  isBus?: boolean;
  labels?: PartnerLabels;
}

export function RoomsStats({
  metrics,
  selectedStatus,
  onSelectStatus,
  unitPlural,
  isBus,
  labels,
}: RoomsStatsProps) {
  if (metrics.total === 0) return null;

  const isRestaurant = labels?.isRestaurant;
  const isDacha = labels?.isDacha;
  const cleanBadge = isRestaurant ? "tayyor" : isBus ? "tayyor" : "toza";
  const dirtyBadge = isRestaurant ? "yig'ishtirishda" : isBus ? "moykada" : "navbatda";
  const occupiedBadge = isRestaurant ? "mijoz bor" : isBus ? "ijarada" : isDacha ? "band" : "yashayapti";
  const outOfServiceBadge = isRestaurant ? "yopiq" : isBus ? "servisda" : "xizmatdan tashqari";

  const occupiedTitle = isRestaurant ? "Band (Mijoz)" : isBus ? "Ijarada (Mijoz)" : isDacha ? "Band" : "Band (Mehmon)";
  const outOfServiceTitle = isRestaurant ? "Zaxirada / Yopiq" : isBus ? "Servis / Ta'mirda" : "Ta'mirda";

  return (
    <section aria-label="Operatsion holat ko'rsatkichlari" className="flex flex-col gap-3">
      <div className={cn(
        "grid gap-3",
        isBus ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      )}>
        {/* Jami */}
        <button
          type="button"
          onClick={() => onSelectStatus("all")}
          aria-pressed={selectedStatus === "all"}
          className={cn(
            "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            selectedStatus === "all"
              ? "border-brand-500/60 bg-brand-50/50 shadow-sm ring-1 ring-brand-500/30 dark:border-brand-500/40 dark:bg-brand-950/20"
              : "border-zinc-200/80 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
          )}
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Jami {unitPlural.toLowerCase()}
            </span>
            <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {metrics.total}
            </span>
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              ta {unitPlural.toLowerCase()}
            </span>
          </div>
        </button>

        {!isBus && (
          <>
            {/* Bo'sh & Tayyor (Toza) */}
            <button
              type="button"
              onClick={() =>
                onSelectStatus(
                  selectedStatus === RoomStatus.VACANT_CLEAN ? "all" : RoomStatus.VACANT_CLEAN
                )
              }
              aria-pressed={selectedStatus === RoomStatus.VACANT_CLEAN}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                selectedStatus === RoomStatus.VACANT_CLEAN
                  ? "border-emerald-500/60 bg-emerald-50/60 shadow-sm ring-1 ring-emerald-500/30 dark:border-emerald-500/40 dark:bg-emerald-950/25"
                  : "border-zinc-200/80 bg-white hover:border-emerald-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
              )}
            >
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                <span className="text-xs font-semibold tracking-wide uppercase">
                  Bo'sh & Tayyor
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
                  {metrics.clean}
                </span>
                <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-500/80">
                  {cleanBadge}
                </span>
              </div>
            </button>

            {/* Tozalanmoqda (Iflos) */}
            <button
              type="button"
              onClick={() =>
                onSelectStatus(
                  selectedStatus === RoomStatus.VACANT_DIRTY ? "all" : RoomStatus.VACANT_DIRTY
                )
              }
              aria-pressed={selectedStatus === RoomStatus.VACANT_DIRTY}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                selectedStatus === RoomStatus.VACANT_DIRTY
                  ? "border-amber-500/60 bg-amber-50/60 shadow-sm ring-1 ring-amber-500/30 dark:border-amber-500/40 dark:bg-amber-950/25"
                  : "border-zinc-200/80 bg-white hover:border-amber-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
              )}
            >
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                <span className="text-xs font-semibold tracking-wide uppercase">
                  Tozalanmoqda
                </span>
                <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400">
                  {metrics.dirty}
                </span>
                <span className="text-xs font-medium text-amber-600/80 dark:text-amber-500/80">
                  {dirtyBadge}
                </span>
              </div>
            </button>

            {/* Band */}
            <button
              type="button"
              onClick={() =>
                onSelectStatus(
                  selectedStatus === RoomStatus.OCCUPIED ? "all" : RoomStatus.OCCUPIED
                )
              }
              aria-pressed={selectedStatus === RoomStatus.OCCUPIED}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                selectedStatus === RoomStatus.OCCUPIED
                  ? "border-blue-500/60 bg-blue-50/60 shadow-sm ring-1 ring-blue-500/30 dark:border-blue-500/40 dark:bg-blue-950/25"
                  : "border-zinc-200/80 bg-white hover:border-blue-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
              )}
            >
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
                <span className="text-xs font-semibold tracking-wide uppercase">
                  {occupiedTitle}
                </span>
                <Users className="h-4 w-4 text-blue-500" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tracking-tight text-blue-700 dark:text-blue-400">
                  {metrics.occupied}
                </span>
                <span className="text-xs font-medium text-blue-600/80 dark:text-blue-500/80">
                  {occupiedBadge}
                </span>
              </div>
            </button>

            {/* Ta'mirda / Zaxirada */}
            <button
              type="button"
              onClick={() =>
                onSelectStatus(
                  selectedStatus === RoomStatus.OUT_OF_SERVICE ? "all" : RoomStatus.OUT_OF_SERVICE
                )
              }
              aria-pressed={selectedStatus === RoomStatus.OUT_OF_SERVICE}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                selectedStatus === RoomStatus.OUT_OF_SERVICE
                  ? "border-red-500/60 bg-red-50/60 shadow-sm ring-1 ring-red-500/30 dark:border-red-500/40 dark:bg-red-950/25"
                  : "border-zinc-200/80 bg-white hover:border-red-200 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700"
              )}
            >
              <div className="flex items-center justify-between text-red-700 dark:text-red-400">
                <span className="text-xs font-semibold tracking-wide uppercase">
                  {outOfServiceTitle}
                </span>
                <Wrench className="h-4 w-4 text-red-500" aria-hidden="true" />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold tracking-tight text-red-700 dark:text-red-400">
                  {metrics.outOfService}
                </span>
                <span className="text-xs font-medium text-red-600/80 dark:text-red-500/80">
                  {outOfServiceBadge}
                </span>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Bandlik darajasi mini info bar */}
      {!isBus && metrics.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Joriy bandlik ko'rsatkichi:
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-white">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
              {metrics.occupancyRate}%
            </span>
            <span className="hidden sm:inline text-xs text-zinc-400 dark:text-zinc-500">
              ({metrics.occupied} band / {metrics.total} jami)
            </span>
          </div>

          <div className="w-36 sm:w-48">
            <OccupancyMeter percent={metrics.occupancyRate} variant="bar" size="sm" showTicks={false} />
          </div>
        </div>
      )}
    </section>
  );
}
