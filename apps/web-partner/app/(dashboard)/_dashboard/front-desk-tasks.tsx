"use client";

import { AlertCircle, CheckCircle2, RotateCcw, Search, X } from "lucide-react";
import { Button } from "../../_components/ui/button";
import { Card } from "../../_components/ui/card";
import { DateRangePicker } from "../../_components/ui/date-range-picker";
import { EmptyState } from "../../_components/ui/empty-state";
import { Input } from "../../_components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../_components/ui/tabs";
import { cn } from "../../_lib/utils/cn";
import { FrontDeskTaskCard, TaskCardSkeleton } from "./front-desk-task-card";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";
import type { DateRange, FilterKey, Task } from "./types";

interface FrontDeskTasksProps {
  tasks: Task[];
  filteredTasks: Task[];
  counts: Record<FilterKey, number>;
  filter: FilterKey;
  onFilterChange: (key: FilterKey) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  isCustomDateRange: boolean;
  onResetDateToToday: () => void;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  labels: PartnerLabels;
  dacha: boolean;
  restaurant?: boolean;
  onCheckIn: (reservation: ReservationView) => void;
  onCheckOut: (reservation: ReservationView) => void;
  onConfirm: (reservation: ReservationView) => void;
  onReject: (reservation: ReservationView) => void;
  onViewDetails?: (reservation: ReservationView) => void;
}

export function FrontDeskTasks({
  filteredTasks,
  counts,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  isCustomDateRange,
  onResetDateToToday,
  isLoading,
  isError,
  onRetry,
  labels,
  dacha,
  restaurant,
  onCheckIn,
  onCheckOut,
  onConfirm,
  onReject,
  onViewDetails,
}: FrontDeskTasksProps) {
  const arrivalTabLabel = labels.isBus
    ? "Olib ketish"
    : labels.isRestaurant
      ? "Kelish"
      : "Kirish";

  const departureTabLabel = labels.isBus
    ? "Qaytarish"
    : labels.isRestaurant
      ? "Ketish"
      : "Chiqish";

  const filterTabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "Hammasi", count: counts.all },
    { key: "pending", label: "Yangi", count: counts.pending },
    { key: "arrival", label: arrivalTabLabel, count: counts.arrival },
    { key: "departure", label: departureTabLabel, count: counts.departure },
  ];

  return (
    <section aria-label="Bugungi vazifalar" className="flex min-w-0 flex-col gap-4">
      {/* Filter, DateRange, and Search Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Accessible Tabs with WAI-ARIA and Keyboard Navigation */}
          <Tabs
            value={filter}
            onValueChange={(val) => onFilterChange(val as FilterKey)}
            variant="segmented"
            className="w-full lg:w-auto"
          >
            <TabsList className="bg-[var(--surface-muted)] border border-[var(--border)] p-1 rounded-xl w-full sm:w-auto">
              {filterTabs.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] text-xs sm:text-sm"
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "flex h-5 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums transition-colors",
                      filter === tab.key
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                        : "bg-[var(--border)] text-[var(--muted-foreground)]",
                    )}
                  >
                    {tab.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Date Range Picker + Quick Today Reset */}
          <div className="flex flex-wrap items-center gap-2.5">
            <DateRangePicker
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onChange={onDateRangeChange}
              placeholder="Sana oralig'i"
              className="text-xs sm:text-sm"
            />
            {isCustomDateRange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetDateToToday}
                className="text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/40 min-h-[44px] sm:min-h-[36px]"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Bugun
              </Button>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder={`${labels.guestLabel} ismi, telefon yoki ID qidirish...`}
            className="h-10 w-full rounded-xl bg-[var(--surface-muted)] pl-9 pr-9 border-[var(--border)] focus-visible:border-[var(--border-strong)] focus-visible:ring-1 focus-visible:ring-brand-500 transition-all text-xs sm:text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Qidiruvni tozalash"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-full min-h-[32px] min-w-[32px] flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Task List / Error / Loading States */}
      {isError ? (
        <Card className="border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 py-8">
          <EmptyState
            icon={
              <AlertCircle
                className="h-10 w-10 text-red-500"
                aria-hidden="true"
              />
            }
            title="Ma'lumotlarni yuklab bo'lmadi"
            description="Server bilan aloqa uzildi yoki xatolik yuz berdi. Iltimos, qayta urinib ko'ring."
            action={
              onRetry ? (
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-[44px] sm:min-h-[36px]"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Qayta urinish
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="border-dashed border-2 border-[var(--border)] bg-transparent shadow-none py-8">
          <EmptyState
            icon={
              <CheckCircle2
                className="h-10 w-10 text-emerald-500/80"
                aria-hidden="true"
              />
            }
            title={searchQuery ? "Natija topilmadi" : "Hammasi joyida"}
            description={
              searchQuery
                ? `"${searchQuery}" so'rovi bo'yicha hech qanday vazifa yoki bron topilmadi.`
                : isCustomDateRange
                  ? "Tanlangan sana oralig'ida vazifalar mavjud emas."
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
              onViewDetails={
                onViewDetails ? () => onViewDetails(reservation) : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
