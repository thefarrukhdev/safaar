"use client";

import { BedDouble, CarFront, LayoutGrid, Table2, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "../../_components/layout/page-header";
import { Button } from "../../_components/ui/button";
import { cn } from "../../_lib/utils/cn";
import type { RoomViewMode } from "./types";

interface RoomsHeaderProps {
  title: string;
  description: string;
  addLabel: string;
  isBus?: boolean;
  restaurant?: boolean;
  viewMode: RoomViewMode;
  onViewModeChange: (mode: RoomViewMode) => void;
  onAddRoom: () => void;
  totalRooms: number;
}

export function RoomsHeader({
  title,
  description,
  addLabel,
  isBus,
  restaurant,
  viewMode,
  onViewModeChange,
  onAddRoom,
  totalRooms,
}: RoomsHeaderProps) {
  const Icon = isBus ? CarFront : restaurant ? UtensilsCrossed : BedDouble;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <PageHeader
        eyebrow="Operatsion"
        title={title}
        description={description}
      />

      <div className="flex flex-wrap items-center gap-2.5 sm:mt-0">
        {totalRooms > 0 && !isBus && (
          <div
            role="group"
            aria-label="Ko'rinish rejimi"
            className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/80 backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              aria-label="To'r (kartochkalar) ko'rinishi"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                viewMode === "grid"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">To'r</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              aria-label="Jadval ko'rinishi"
              aria-pressed={viewMode === "table"}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                viewMode === "table"
                  ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              )}
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Jadval</span>
            </button>
          </div>
        )}

        <Button onClick={onAddRoom} className="gap-2 shadow-sm font-semibold">
          <Icon className="h-4 w-4" aria-hidden="true" />
          <span>{addLabel}</span>
        </Button>
      </div>
    </div>
  );
}
