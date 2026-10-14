"use client";

import { Search, X, RotateCcw } from "lucide-react";
import { Select, type SelectOptionItem } from "../../_components/ui/select";
import { Button } from "../../_components/ui/button";
import { cn } from "../../_lib/utils/cn";
import type { VehicleSortOption, VehicleStatusFilter } from "./vehicles-types";

interface VehiclesFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatus: VehicleStatusFilter;
  onStatusChange: (status: VehicleStatusFilter) => void;
  sortBy: VehicleSortOption;
  onSortChange: (sort: VehicleSortOption) => void;
  onResetFilters: () => void;
  activeCount: number;
  inactiveCount: number;
}

export function VehiclesFilters({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  sortBy,
  onSortChange,
  onResetFilters,
  activeCount,
  inactiveCount,
}: VehiclesFiltersProps) {
  const isFiltered =
    Boolean(searchQuery.trim()) ||
    selectedStatus !== "all" ||
    sortBy !== "name";

  const statusOptions: SelectOptionItem[] = [
    { value: "all", label: "Barcha holatlar" },
    { value: "active", label: `✓ Faol (${activeCount})` },
    { value: "inactive", label: `Nofaol (${inactiveCount})` },
  ];

  const sortOptions: SelectOptionItem[] = [
    { value: "name", label: "Nomi bo'yicha (A-Z)" },
    { value: "price_asc", label: "Narx: arzondan qimmatga" },
    { value: "price_desc", label: "Narx: qimmatdan arzonga" },
    { value: "seats_desc", label: "O'rindiqlar ko'pdan kamga" },
    { value: "status", label: "Holati bo'yicha" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur-sm">
      {/* Qidiruv kiritish */}
      <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rusumi yoki davlat raqami bo'yicha qidirish..."
          aria-label="Avtomobillarni qidirish"
          className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-9 pr-9 text-sm text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-white dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
        />
        {searchQuery.trim() && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Qidiruvni tozalash"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Filtrlar va saralash boshqaruvi */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tezkor status filter tugmalari (planshet va desktop uchun) */}
        <div
          role="group"
          aria-label="Holat filtri"
          className="hidden md:inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/80 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => onStatusChange("all")}
            aria-pressed={selectedStatus === "all"}
            className={cn(
              "inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer",
              selectedStatus === "all"
                ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            )}
          >
            Barchasi
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("active")}
            aria-pressed={selectedStatus === "active"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer",
              selectedStatus === "active"
                ? "bg-emerald-50 text-emerald-700 shadow-xs dark:bg-emerald-950/60 dark:text-emerald-300"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Faol ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => onStatusChange("inactive")}
            aria-pressed={selectedStatus === "inactive"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer",
              selectedStatus === "inactive"
                ? "bg-amber-50 text-amber-700 shadow-xs dark:bg-amber-950/60 dark:text-amber-300"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            )}
          >
            Nofaol ({inactiveCount})
          </button>
        </div>

        {/* Mobil uchun Select status filter */}
        <div className="w-[160px] md:hidden">
          <Select
            aria-label="Holat filtri"
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as VehicleStatusFilter)}
            options={statusOptions}
          />
        </div>

        {/* Saralash Select */}
        <div className="w-[180px]">
          <Select
            aria-label="Saralash tartibi"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as VehicleSortOption)}
            options={sortOptions}
          />
        </div>

        {/* Filtrlarni tozalash tugmasi */}
        {isFiltered && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-10 gap-1.5 px-3 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Tozalash</span>
          </Button>
        )}
      </div>
    </div>
  );
}
