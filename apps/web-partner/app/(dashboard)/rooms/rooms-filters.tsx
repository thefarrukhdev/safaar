"use client";

import { Search, X, RotateCcw } from "lucide-react";
import { RoomStatus, type RoomType } from "../../_lib/domain/types";
import { Select, type SelectOptionItem } from "../../_components/ui/select";
import { Button } from "../../_components/ui/button";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { RoomSortOption } from "./types";

interface RoomsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFloor: number | "all";
  onFloorChange: (floor: number | "all") => void;
  availableFloors: number[];
  selectedType: string | "all";
  onTypeChange: (typeId: string | "all") => void;
  roomTypes: RoomType[];
  selectedStatus: RoomStatus | "all";
  onStatusChange: (status: RoomStatus | "all") => void;
  sortBy: RoomSortOption;
  onSortChange: (sort: RoomSortOption) => void;
  onResetFilters: () => void;
  unitSingular: string;
  floorSingular: string;
  isBus?: boolean;
  labels?: PartnerLabels;
}

export function RoomsFilters({
  searchQuery,
  onSearchChange,
  selectedFloor,
  onFloorChange,
  availableFloors,
  selectedType,
  onTypeChange,
  roomTypes,
  selectedStatus,
  onStatusChange,
  sortBy,
  onSortChange,
  onResetFilters,
  unitSingular,
  floorSingular,
  isBus,
  labels,
}: RoomsFiltersProps) {
  const isFiltered =
    Boolean(searchQuery.trim()) ||
    selectedFloor !== "all" ||
    selectedType !== "all" ||
    selectedStatus !== "all" ||
    sortBy !== "number";

  const floorLabelPlural = labels?.floorPlural ?? "qavatlar";
  const unitTypeLabelPlural = labels?.unitTypePlural ?? "turlar";

  const floorOptions: SelectOptionItem[] = [
    { value: "all", label: `Barcha ${floorLabelPlural}` },
    ...availableFloors.map((fl) => ({
      value: String(fl),
      label: `${fl}-${floorSingular}`,
    })),
  ];

  const typeOptions: SelectOptionItem[] = [
    { value: "all", label: `Barcha ${unitTypeLabelPlural.toLowerCase()}` },
    ...roomTypes.map((rt) => ({
      value: rt.id,
      label: rt.name,
    })),
  ];

  const statusOptions: SelectOptionItem[] = [
    { value: "all", label: "Barcha holatlar" },
    { value: RoomStatus.VACANT_CLEAN, label: `✓ ${labels?.statusCleanLabel ?? "Bo'sh & Tayyor (Toza)"}` },
    { value: RoomStatus.VACANT_DIRTY, label: `🧹 ${labels?.statusDirtyLabel ?? "Tozalanmoqda (Notoza)"}` },
    { value: RoomStatus.OCCUPIED, label: `👤 ${labels?.statusOccupiedLabel ?? "Band (Mehmon bor)"}` },
    { value: RoomStatus.OUT_OF_SERVICE, label: `🔧 ${labels?.statusOutOfServiceLabel ?? "Ta'mirda"}` },
    { value: RoomStatus.BLOCKED, label: "🚫 Bloklangan" },
  ];

  const sortOptions: SelectOptionItem[] = [
    { value: "number", label: "Raqam bo'yicha" },
    { value: "status", label: "Holati bo'yicha" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur-sm">
      {/* Qidiruv kiritish */}
      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={`${unitSingular} raqami yoki turi bo'yicha qidirish...`}
          aria-label={`${unitSingular} qidirish`}
          className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 pl-9 pr-9 text-sm text-zinc-900 transition-all placeholder:text-zinc-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-white dark:placeholder:text-zinc-500 dark:focus:bg-zinc-800"
        />
        {searchQuery.trim() && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            aria-label="Qidiruvni tozalash"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Select filtrlar to'plami */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Qavat filtri */}
        {availableFloors.length > 1 && (
          <div className="w-[145px]">
            <Select
              aria-label={floorSingular}
              value={selectedFloor === "all" ? "all" : String(selectedFloor)}
              onChange={(e) =>
                onFloorChange(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              options={floorOptions}
            />
          </div>
        )}

        {/* Xona turi filtri */}
        {roomTypes.length > 0 && (
          <div className="w-[160px]">
            <Select
              aria-label={labels?.unitTypeLabel ?? "Toifa"}
              value={selectedType}
              onChange={(e) => onTypeChange(e.target.value)}
              options={typeOptions}
            />
          </div>
        )}

        {/* Holat filtri */}
        {!isBus && (
          <div className="w-[170px]">
            <Select
              aria-label="Holat filtri"
              value={selectedStatus}
              onChange={(e) => onStatusChange(e.target.value as RoomStatus | "all")}
              options={statusOptions}
            />
          </div>
        )}

        {/* Saralash */}
        <div className="w-[145px]">
          <Select
            aria-label="Saralash"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as RoomSortOption)}
            options={sortOptions}
          />
        </div>

        {/* Filtrlarni tozalash */}
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
