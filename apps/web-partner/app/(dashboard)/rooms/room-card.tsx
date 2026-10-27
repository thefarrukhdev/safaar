"use client";

import {
  BedSingle,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { RoomStatus, type Bed, type Room, type RoomType } from "../../_lib/domain/types";
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

import { type PartnerLabels, formatUnitTypeName } from "../../_lib/utils/partner-labels";

interface RoomCardProps {
  room: Room;
  roomType?: RoomType;
  beds?: Bed[];
  restaurant?: boolean;
  isBus?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onManageBeds?: () => void;
  onStatusChange: (status: RoomStatus) => void;
  onToggleListed: () => void;
  onToggleBusStatus?: () => void;
  isUpdating?: boolean;
  labels: PartnerLabels | {
    unitSingular: string;
    unitPlural: string;
    capacitySuffix: string;
    priceLabel: string;
    unitStatusLabel?: string;
    statusCleanLabel?: string;
    statusDirtyLabel?: string;
    statusOccupiedLabel?: string;
    statusOutOfServiceLabel?: string;
  };
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function RoomCard({
  room,
  roomType,
  beds,
  restaurant,
  isBus,
  onEdit,
  onDelete,
  onManageBeds,
  onStatusChange,
  onToggleListed,
  onToggleBusStatus,
  isUpdating,
  labels,
  isSelected,
  onToggleSelect,
}: RoomCardProps) {
  const freeBeds = beds?.filter((b) => b.status === RoomStatus.VACANT_CLEAN).length ?? 0;
  const price = room.nightlyPrice ?? roomType?.basePrice;

  return (
    <div
      className={cn(
        "group relative flex h-full w-full flex-col justify-between rounded-2xl border bg-white p-4 text-left shadow-xs transition-all duration-200 hover:shadow-md dark:bg-zinc-900/60 backdrop-blur-sm",
        isSelected
          ? "border-brand-500 bg-brand-50/20 ring-2 ring-brand-500/30 dark:border-brand-500/80 dark:bg-brand-950/20"
          : "border-zinc-200/80 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
        !room.isListed && "opacity-75 bg-zinc-50/60 dark:bg-zinc-900/30 grayscale-[30%]",
        room.status === RoomStatus.OUT_OF_SERVICE &&
          "border-red-200/80 bg-red-50/10 dark:border-red-900/40 dark:bg-red-950/10"
      )}
    >
      {/* Yuqori qism: Tanlash katakchasi, Xona raqami va Amallar menyusi */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <label
              className="relative flex items-center justify-center p-1 -m-1 cursor-pointer"
              title={`${room.number} tanlash`}
            >
              <input
                type="checkbox"
                checked={Boolean(isSelected)}
                onChange={onToggleSelect}
                aria-label={`${room.number} tanlash`}
                className="h-4 w-4 rounded-md border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-brand-600 cursor-pointer transition-colors"
              />
            </label>

            <button
              type="button"
              onClick={onEdit}
              className="text-2xl font-bold tracking-tight text-zinc-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 transition-colors truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
              title={`${room.number} ma'lumotlarini tahrirlash`}
            >
              {room.number}
            </button>

            {!room.isListed && (
              <span className="rounded-md bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
                YASHIRILGAN
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
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
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800"
                  title="Qo'shimcha amallar"
                  aria-label="Qo'shimcha amallar"
                >
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="w-52">
                <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Tahrirlash</span>
                </DropdownMenuItem>

                {beds && onManageBeds && (
                  <DropdownMenuItem onClick={onManageBeds}>
                    <BedSingle className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Joylarni boshqarish</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={onToggleListed}>
                  {room.isListed ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Sotuvdan yashirish</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                      <span>Sotuvga chiqarish</span>
                    </>
                  )}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem destructive onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  <span>O'chirish</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Housekeeping / Holat selektori */}
        <div className="mt-3">
          {isBus ? (
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                  room.status === RoomStatus.OUT_OF_SERVICE
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                )}
              >
                {room.status === RoomStatus.OUT_OF_SERVICE ? "Faol emas" : "Faol"}
              </span>
              {onToggleBusStatus && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onToggleBusStatus}
                  disabled={isUpdating}
                  className={cn(
                    "h-6 px-2 text-[11px] font-semibold",
                    room.status === RoomStatus.OUT_OF_SERVICE
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                  )}
                >
                  {room.status === RoomStatus.OUT_OF_SERVICE ? "Faollashtirish" : "O'chirish"}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`status-select-${room.id}`}
                className="text-[10px] font-bold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase"
              >
                {labels.unitStatusLabel ?? "Holati"}
              </label>
              <select
                id={`status-select-${room.id}`}
                aria-label={`${room.number} ${labels.unitSingular.toLowerCase()} holati`}
                value={room.status}
                disabled={isUpdating}
                onChange={(e) => onStatusChange(e.target.value as RoomStatus)}
                className={cn(
                  "w-full cursor-pointer rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/20",
                  room.status === RoomStatus.VACANT_CLEAN &&
                    "border-emerald-200/90 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
                  room.status === RoomStatus.VACANT_DIRTY &&
                    "border-amber-200/90 bg-amber-50/80 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
                  room.status === RoomStatus.OCCUPIED &&
                    "border-blue-200/90 bg-blue-50/80 text-blue-800 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300",
                  room.status === RoomStatus.OUT_OF_SERVICE &&
                    "border-red-200/90 bg-red-50/80 text-red-800 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300",
                  room.status === RoomStatus.BLOCKED &&
                    "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                )}
              >
                <option value={RoomStatus.VACANT_CLEAN}>✓ {labels.statusCleanLabel ?? "Bo'sh & Tayyor"}</option>
                <option value={RoomStatus.VACANT_DIRTY}>🧹 {labels.statusDirtyLabel ?? "Tozalanmoqda"}</option>
                <option value={RoomStatus.OCCUPIED}>👤 {labels.statusOccupiedLabel ?? "Band"}</option>
                <option value={RoomStatus.OUT_OF_SERVICE}>🔧 {labels.statusOutOfServiceLabel ?? "Ta'mirda"}</option>
                <option value={RoomStatus.BLOCKED}>🚫 Bloklangan</option>
              </select>
            </div>
          )}
        </div>

        {/* Xona turi va sig'im ma'lumotlari */}
        <div className="mt-3 flex flex-col gap-1">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
            {formatUnitTypeName(room.roomTypeName || roomType?.name || "", labels)}
          </span>

          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              {roomType?.capacity || "?"} {labels.capacitySuffix}
            </span>
            {!restaurant && !isBus && roomType?.bedType && (
              <>
                <span>·</span>
                <span className="truncate">{roomType.bedType}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quyi qism: Narx, Yotoqlar va Sotuv switch */}
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          {!restaurant && (
            <div>
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                {labels.priceLabel}
              </span>
              <div className="text-sm font-bold text-zinc-900 dark:text-white">
                {price ? formatMoney(price) : "—"}
              </div>
            </div>
          )}

          {beds && onManageBeds && (
            <div className="ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onManageBeds}
                className="h-7 px-2 text-[11px] font-semibold gap-1 text-zinc-700 dark:text-zinc-300"
              >
                <BedSingle className="h-3 w-3" aria-hidden="true" />
                <span>
                  {freeBeds}/{beds.length} bo'sh
                </span>
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-2.5">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Sotuvda ko'rsatish
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={room.isListed}
              disabled={isUpdating}
              onChange={onToggleListed}
              aria-label={`${room.number} sotuvda ko'rsatish`}
            />
            <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500/30 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-brand-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
