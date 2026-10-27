"use client";

import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Button } from "../../_components/ui/button";
import { Input } from "../../_components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../_components/ui/tabs";
import { Tooltip } from "../../_components/ui/tooltip";
import type { ViewMode } from "./types";

interface RoomTypeOption {
  id: string;
  name: string;
}

interface CalendarFiltersProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  startOffset: number;
  onPrevPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  startDateIso: string;
  onJumpToDate: (iso: string) => void;
  periodLabel: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: string;
  onTypeFilterChange: (typeId: string) => void;
  roomTypes: RoomTypeOption[];
  statusFilter: "all" | "occupied" | "vacant";
  onStatusFilterChange: (status: "all" | "occupied" | "vacant") => void;
  unitTypeLabel: string;
  unitPlural?: string;
  unitTypePlural?: string;
  unitStatusLabel?: string;
  searchPlaceholder?: string;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export function CalendarFilters({
  viewMode,
  onViewModeChange,
  startOffset,
  onPrevPeriod,
  onNextPeriod,
  onToday,
  startDateIso,
  onJumpToDate,
  periodLabel,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  roomTypes,
  statusFilter,
  onStatusFilterChange,
  unitTypeLabel,
  unitPlural,
  unitTypePlural,
  unitStatusLabel,
  searchPlaceholder,
  hasActiveFilters,
  onResetFilters,
}: CalendarFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs">
      {/* Yuqori qator: View mode va Sana navigatsiyasi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* View mode segmented tabs */}
        <div className="flex items-center gap-2">
          <Tabs
            value={String(viewMode)}
            onValueChange={(val) => onViewModeChange(Number(val) as ViewMode)}
            variant="segmented"
          >
            <TabsList aria-label="Ko'rinish davri">
              <TabsTrigger value="7" className="text-xs sm:text-sm">
                7 kun
              </TabsTrigger>
              <TabsTrigger value="14" className="text-xs sm:text-sm">
                14 kun
              </TabsTrigger>
              <TabsTrigger value="30" className="text-xs sm:text-sm">
                30 kun
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Date navigation controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Tooltip content="Oldingi davr">
            <Button
              variant="outline"
              size="icon"
              onClick={onPrevPeriod}
              aria-label="Oldingi davr"
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Tooltip>

          <Button
            variant={startOffset === 0 ? "secondary" : "outline"}
            size="sm"
            onClick={onToday}
            className="h-9 text-xs font-semibold gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            Bugun
          </Button>

          <Tooltip content="Keyingi davr">
            <Button
              variant="outline"
              size="icon"
              onClick={onNextPeriod}
              aria-label="Keyingi davr"
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Tooltip>

          {/* Quick jump to date via native date input */}
          <div className="relative flex items-center">
            <label htmlFor="calendar-jump-date" className="sr-only">
              Sanaga o'tish
            </label>
            <div className="relative flex items-center">
              <CalendarIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
              <input
                id="calendar-jump-date"
                type="date"
                value={startDateIso}
                onChange={(e) => {
                  if (e.target.value) {
                    onJumpToDate(e.target.value);
                  }
                }}
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 pl-8 pr-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                title="Istalgan sanaga to'g'ridan-to'g'ri o'tish"
              />
            </div>
          </div>

          {/* Active Period Label */}
          <div className="ml-1 inline-flex items-center rounded-lg bg-brand-50/70 px-2.5 py-1.5 text-xs font-semibold text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">
            {periodLabel}
          </div>
        </div>
      </div>

      {/* Quyi qator: Qidiruv, xona turi filtri, status filtri va tozalash */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-[var(--border)]/60">
        {/* Qidiruv */}
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder || "Xona raqami yoki turi..."}
            className="h-9 pl-8 pr-8 text-xs placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Qidiruvni tozalash"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Xona turi bo'yicha filter */}
        <select
          aria-label={unitTypeLabel}
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)] focus:border-brand-600 focus:outline-none"
        >
          <option value="all">Barcha {unitTypePlural || `${unitTypeLabel.toLowerCase()}lari`}</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </select>

        {/* Status filtri */}
        <select
          aria-label={unitStatusLabel || "Holati"}
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as "all" | "occupied" | "vacant")}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)] focus:border-brand-600 focus:outline-none"
        >
          <option value="all">Barcha holatlar</option>
          <option value="occupied">Faqat band (ichkarida)</option>
          <option value="vacant">Faqat bo'sh {unitPlural || "xonalar"}</option>
        </select>

        {/* Filtrni tiklash tugmasi */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-9 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Filtrni tozalash
          </Button>
        )}
      </div>
    </div>
  );
}
