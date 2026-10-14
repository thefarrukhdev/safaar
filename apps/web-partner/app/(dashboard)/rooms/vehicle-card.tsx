"use client";

import {
  CarFront,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../../_components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../_components/ui/dropdown-menu";
import { formatMoney } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";
import type { Vehicle } from "./vehicles-types";

export function formatPlateDisplay(value: string | null | undefined): string {
  if (!value) return "RAQAM YO'Q";
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) return "RAQAM YO'Q";
  if (raw.length <= 2) return raw;

  const region = raw.slice(0, 2);
  const rest = raw.slice(2);

  const isPhysical = /^[A-Z]/.test(rest);
  if (isPhysical) {
    const letter = rest.slice(0, 1);
    const nums = rest.slice(1, 4);
    const series = rest.slice(4, 6);
    return [region, letter, nums, series].filter(Boolean).join(" ");
  } else {
    const nums = rest.slice(0, 3);
    const series = rest.slice(3, 6);
    return [region, nums, series].filter(Boolean).join(" ");
  }
}

interface VehicleCardProps {
  vehicle: Vehicle;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
  onToggleStatus: (vehicle: Vehicle) => Promise<void>;
}

export function VehicleCard({
  vehicle,
  onEdit,
  onDelete,
  onToggleStatus,
}: VehicleCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(vehicle.status);

  // Sync if vehicle.status changes externally
  if (vehicle.status !== optimisticStatus && !isUpdating) {
    setOptimisticStatus(vehicle.status);
  }

  const handleToggle = async () => {
    if (isUpdating) return;
    const nextStatus = optimisticStatus === "active" ? "inactive" : "active";
    setOptimisticStatus(nextStatus);
    setIsUpdating(true);
    try {
      await onToggleStatus(vehicle);
    } catch {
      // Revert on failure
      setOptimisticStatus(vehicle.status);
    } finally {
      setIsUpdating(false);
    }
  };

  const formattedPlate = formatPlateDisplay(vehicle.plateNumber);
  const isActive = optimisticStatus === "active";

  return (
    <div
      className={cn(
        "group relative flex h-full w-full flex-col justify-between rounded-2xl border bg-white p-5 text-left shadow-xs transition-all duration-200 hover:shadow-md dark:bg-zinc-900/60 backdrop-blur-sm",
        isActive
          ? "border-zinc-200/80 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
          : "border-zinc-200/60 bg-zinc-50/60 opacity-80 dark:border-zinc-800/80 dark:bg-zinc-900/30 grayscale-[25%]"
      )}
    >
      {/* Yuqori qism: Avtomobil nomi, holat nishoni va amallar */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400"
                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              )}
            >
              <CarFront className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white truncate">
                {vehicle.name}
              </h3>

              {/* Uzbekistan Davlat Raqami Badge */}
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  className="inline-flex items-center gap-1.5 rounded-lg border-2 border-zinc-800 bg-white px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-zinc-900 shadow-2xs dark:border-zinc-300 dark:bg-zinc-100 dark:text-zinc-900"
                  title={`Davlat raqami: ${formattedPlate}`}
                >
                  <span className="flex items-center gap-1 border-r border-zinc-300 pr-1 text-[10px] font-black text-blue-600">
                    <span className="h-1.5 w-2 rounded-2xs bg-blue-500 inline-block" />
                    UZ
                  </span>
                  <span className="tracking-widest font-black">{formattedPlate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Amallar: Tahrirlash va 3-nuqta Dropdown Menu */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(vehicle)}
              className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
              title="Tahrirlash"
              aria-label="Tahrirlash"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800"
                  title="Qo'shimcha amallar"
                  aria-label="Qo'shimcha amallar"
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-52">
                <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                  <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Tahrirlash</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={handleToggle} disabled={isUpdating}>
                  {isActive ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                      <span>E'londan olish (Yopish)</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>E'longa chiqarish (Faol)</span>
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  destructive
                  onClick={() => onDelete(vehicle)}
                  disabled={isUpdating}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  <span>O'chirish</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Xususiyatlar: O'rindiqlar soni va Holat pill */}
        <div className="mt-4 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-medium">
            <Users className="h-4 w-4 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
            <span>{vehicle.seatsCount} kishilik o'rindiq</span>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
              isActive
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60"
                : "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              )}
            />
            {isActive ? "Faol (Sotuvda)" : "Nofaol"}
          </span>
        </div>
      </div>

      {/* Quyi qism: Narx va Tezkor status switch */}
      <div className="mt-5 border-t border-zinc-100 dark:border-zinc-800/80 pt-3.5 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Kunlik ijara narxi:
          </span>
          <div className="text-base font-bold text-zinc-900 dark:text-white">
            {formatMoney(vehicle.pricePerDay)}
          </div>
        </div>

        {/* Tezkor status switch */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-2.5">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Sotuvda ko'rsatish
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {isActive ? "Mijozlar buyurtma qila oladi" : "Vaqtincha to'xtatilgan"}
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isActive}
              disabled={isUpdating}
              onChange={handleToggle}
              aria-label={`${vehicle.name} sotuvda ko'rsatish`}
            />
            <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500/30 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-emerald-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
