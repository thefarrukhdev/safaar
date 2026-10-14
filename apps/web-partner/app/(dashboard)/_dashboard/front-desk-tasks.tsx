"use client";

import { CheckCircle2, Search, X } from "lucide-react";
import { Card } from "../../_components/ui/card";
import { EmptyState } from "../../_components/ui/empty-state";
import { Input } from "../../_components/ui/input";
import { cn } from "../../_lib/utils/cn";
import { FrontDeskTaskCard, TaskCardSkeleton } from "./front-desk-task-card";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";
import type { FilterKey, Task } from "./types";

interface FrontDeskTasksProps {
  tasks: Task[];
  filteredTasks: Task[];
  counts: Record<FilterKey, number>;
  filter: FilterKey;
  onFilterChange: (key: FilterKey) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
  labels: PartnerLabels;
  dacha: boolean;
  restaurant?: boolean;
  onCheckIn: (reservation: ReservationView) => void;
  onCheckOut: (reservation: ReservationView) => void;
  onConfirm: (reservation: ReservationView) => void;
  onReject: (reservation: ReservationView) => void;
}

export function FrontDeskTasks({
  filteredTasks,
  counts,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  isLoading,
  labels,
  dacha,
  restaurant,
  onCheckIn,
  onCheckOut,
  onConfirm,
  onReject,
}: FrontDeskTasksProps) {
  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "Hammasi", count: counts.all },
    { key: "pending", label: "Yangi", count: counts.pending },
    { key: "arrival", label: labels.checkInLabel, count: counts.arrival },
    { key: "departure", label: labels.checkOutLabel, count: counts.departure },
  ];

  return (
    <section aria-label="Bugungi vazifalar" className="flex min-w-0 flex-col gap-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        {/* Filter Navigation */}
        <div
          role="tablist"
          aria-label="Vazifalar toifalari"
          className="flex items-center gap-1.5 p-1 bg-[var(--surface-muted)] rounded-xl overflow-x-auto w-full lg:w-auto scrollbar-none"
        >
          {filterTabs.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onFilterChange(tab.key)}
                className={cn(
                  "relative inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-all duration-150 min-h-[40px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  isActive
                    ? "bg-[var(--surface)] text-[var(--foreground)] font-semibold shadow-sm ring-1 ring-[var(--border)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "flex h-5 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
                    isActive
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                      : "bg-[var(--border)] text-[var(--muted-foreground)]",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative shrink-0 w-full lg:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder={`${labels.guestLabel} yoki ID qidirish...`}
            className="h-10 w-full rounded-xl bg-[var(--surface-muted)] pl-9 pr-8 border-transparent focus-visible:border-[var(--border-strong)] focus-visible:ring-1 focus-visible:ring-brand-500 transition-all text-xs sm:text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Qidiruvni tozalash"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-dashed border-2 border-[var(--border)] bg-transparent shadow-none py-8">
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10 text-emerald-500/80" aria-hidden="true" />}
            title={searchQuery ? "Natija topilmadi" : "Hammasi joyida"}
            description={
              searchQuery
                ? `"${searchQuery}" so'rovi bo'yicha hech qanday vazifa yoki bron topilmadi.`
                : "Hozircha bajarilishi kerak bo'lgan vazifalar mavjud emas. Barcha amallar bajarilgan."
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTasks.map(({ kind, reservation }) => (
            <FrontDeskTaskCard
              key={`${kind}-${reservation.id}`}
              kind={kind}
              reservation={reservation}
              labels={labels}
              dacha={dacha}
              restaurant={restaurant}
              onCheckIn={() => onCheckIn(reservation)}
              onCheckOut={() => onCheckOut(reservation)}
              onConfirm={() => onConfirm(reservation)}
              onReject={() => onReject(reservation)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
