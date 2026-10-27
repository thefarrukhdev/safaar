"use client";

import { useRef } from "react";
import {
  CalendarDays,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Button } from "../../_components/ui/button";
import { DateRangePicker } from "../../_components/ui/date-range-picker";
import { Input } from "../../_components/ui/input";
import { cn } from "../../_lib/utils/cn";
import { getReservationFilters, type FilterKey, type ViewMode } from "./types";
import { todayIso } from "../../_lib/utils/date";

interface ReservationsFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  startDate: string;
  endDate: string;
  onDateChange: (range: { startDate: string; endDate: string }) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  filteredCount: number;
  totalCount: number;
  unitSingular: string;
  guestLabel?: string;
  partnerType?: string | null;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  statusFilter?: FilterKey;
  onStatusFilterChange?: (filter: FilterKey) => void;
  counts?: Record<FilterKey, number>;
}

export function ReservationsFilters({
  query,
  onQueryChange,
  startDate,
  endDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  filteredCount,
  totalCount,
  unitSingular,
  guestLabel,
  partnerType,
  hasActiveFilters,
  onResetFilters,
  statusFilter,
  onStatusFilterChange,
  counts,
}: ReservationsFiltersProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filters = getReservationFilters(partnerType);

  const today = todayIso();
  const dTomorrow = new Date();
  dTomorrow.setDate(dTomorrow.getDate() + 1);
  const tomorrowIso = dTomorrow.toISOString().slice(0, 10);

  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + 1);
  const thisWeekMon = mon.toISOString().slice(0, 10);
  const sun = new Date(now);
  sun.setDate(now.getDate() - day + 7);
  const thisWeekSun = sun.toISOString().slice(0, 10);

  const isTodayActive = startDate === today && endDate === today;
  const isTomorrowActive = startDate === tomorrowIso && endDate === tomorrowIso;
  const isThisWeekActive = startDate === thisWeekMon && endDate === thisWeekSun;

  // Quick Date presets (toggleable)
  const handleSetToday = () => {
    if (isTodayActive) {
      onDateChange({ startDate: "", endDate: "" });
    } else {
      onDateChange({ startDate: today, endDate: today });
    }
  };

  const handleSetTomorrow = () => {
    if (isTomorrowActive) {
      onDateChange({ startDate: "", endDate: "" });
    } else {
      onDateChange({ startDate: tomorrowIso, endDate: tomorrowIso });
    }
  };

  const handleSetThisWeek = () => {
    if (isThisWeekActive) {
      onDateChange({ startDate: "", endDate: "" });
    } else {
      onDateChange({ startDate: thisWeekMon, endDate: thisWeekSun });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xs">
      {/* Mobile Horizontal Status Tabs (< xl) */}
      {statusFilter && onStatusFilterChange && (
        <div className="xl:hidden -mx-1 overflow-x-auto no-scrollbar pb-1 border-b border-[var(--border)]">
          <div className="flex items-center gap-1.5 min-w-max px-1">
            {filters.map((f) => {
              const active = statusFilter === f.key;
              const count = counts?.[f.key] ?? 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onStatusFilterChange(f.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all min-h-[36px]",
                    active
                      ? "bg-brand-600 text-white shadow-xs font-semibold"
                      : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)]",
                  )}
                >
                  <span>{f.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-black/5 dark:bg-white/10 text-[var(--muted-foreground)]",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Toolbar: Search + Date Range + View Mode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input with quick clear */}
        <div className="relative flex-1 min-w-[240px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            placeholder={`ID, ${guestLabel || "mehmon"} ismi, telefon, ${unitSingular} bo'yicha tezkor qidirish...`}
            className="pl-9 pr-9 h-10 w-full rounded-lg"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Bronlar ichidan qidirish"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label="Qidiruvni tozalash"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        {/* Date Range Picker */}
        <div className="shrink-0">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={onDateChange}
            placeholder="Sana oralig'i"
            showPresets
          />
        </div>

        {/* View Switcher & Result Count */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div
            role="group"
            aria-label="Ko'rinish rejimi"
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1"
          >
            <Button
              type="button"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("table")}
              className={cn(
                "h-8 px-2.5 text-xs font-medium gap-1.5",
                viewMode === "table"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
              title="Jadval ko'rinishi (Desktop uchun qulay)"
              aria-pressed={viewMode === "table"}
            >
              <List className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Jadval</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "card" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onViewModeChange("card")}
              className={cn(
                "h-8 px-2.5 text-xs font-medium gap-1.5",
                viewMode === "card"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
              title="Kartochka ko'rinishi (Mobil va sensorli)"
              aria-pressed={viewMode === "card"}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Kartochka</span>
            </Button>
          </div>

          {/* Matches Count */}
          <div className="rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] whitespace-nowrap border border-[var(--border)]">
            <span className="font-semibold text-[var(--foreground)] tabular-nums">
              {filteredCount}
            </span>
            <span className="text-[var(--muted-foreground)]"> / {totalCount} ta</span>
          </div>
        </div>
      </div>

      {/* Ergonomic Quick Preset Pills & Active Filter Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[var(--muted-foreground)] mr-1 hidden sm:inline flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Tezkor sanalar:
          </span>
          <button
            type="button"
            onClick={handleSetToday}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
              isTodayActive
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-semibold"
                : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
            )}
          >
            Bugun
          </button>
          <button
            type="button"
            onClick={handleSetTomorrow}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
              isTomorrowActive
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-semibold"
                : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
            )}
          >
            Ertaga
          </button>
          <button
            type="button"
            onClick={handleSetThisWeek}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
              isThisWeekActive
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300 font-semibold"
                : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
            )}
          >
            Shu hafta
          </button>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-7 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 gap-1 px-2"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            <span>Filtrlarni tozalash</span>
          </Button>
        )}
      </div>
    </div>
  );
}
