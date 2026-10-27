"use client";

import { useEffect, useRef } from "react";
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
import { type PartnerLabels, formatUnitTypeName } from "../../_lib/utils/partner-labels";
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

export interface RoomsTableProps {
  rooms: Room[];
  roomTypes: RoomType[];
  beds: Bed[];
  isHostel: boolean;
  restaurant: boolean;
  isBus: boolean;
  labels: PartnerLabels;
  selectedRoomIds: Set<string>;
  onToggleRoom: (id: string) => void;
  onToggleSelectAllVisible: () => void;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onManageBeds: (room: Room) => void;
  onStatusChange: (room: Room, status: RoomStatus) => void;
  onToggleListed: (room: Room) => void;
  onToggleBusStatus?: (room: Room) => void;
  updatingRoomId: string | null;
}

export function RoomsTable({
  rooms,
  roomTypes,
  beds,
  isHostel,
  restaurant,
  isBus,
  labels,
  selectedRoomIds,
  onToggleRoom,
  onToggleSelectAllVisible,
  onEditRoom,
  onDeleteRoom,
  onManageBeds,
  onStatusChange,
  onToggleListed,
  onToggleBusStatus,
  updatingRoomId,
}: RoomsTableProps) {
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const isAllVisibleSelected =
    rooms.length > 0 && rooms.every((r) => selectedRoomIds.has(r.id));
  const isSomeVisibleSelected =
    rooms.some((r) => selectedRoomIds.has(r.id)) && !isAllVisibleSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeVisibleSelected;
    }
  }, [isSomeVisibleSelected]);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[860px]">
          <thead>
            <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              {/* Tanlash checkbox ustuni */}
              <th scope="col" className="w-12 px-4 py-3.5 text-center">
                <label
                  className="relative inline-flex items-center justify-center p-1 cursor-pointer"
                  title="Barchasini tanlash"
                >
                  <input
                    type="checkbox"
                    ref={headerCheckboxRef}
                    checked={isAllVisibleSelected}
                    onChange={onToggleSelectAllVisible}
                    aria-label="Barchasini tanlash"
                    className="h-4 w-4 rounded-md border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-brand-600 cursor-pointer transition-colors"
                  />
                </label>
              </th>

              {/* Xona raqami & turi */}
              <th scope="col" className="px-4 py-3.5">
                {labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} raqami & {labels.unitTypeLabel.toLowerCase()}
              </th>

              {/* Qavat */}
              <th scope="col" className="px-4 py-3.5">
                {labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}
              </th>

              {/* Sig'imi */}
              <th scope="col" className="px-4 py-3.5">
                Sig'imi
              </th>

              {/* Yotoqlar (hostel bo'lsa) */}
              {isHostel && (
                <th scope="col" className="px-4 py-3.5">
                  Yotoqlar
                </th>
              )}

              {/* Birlik holati */}
              <th scope="col" className="px-4 py-3.5">
                {labels.unitStatusLabel}
              </th>

              {/* Kunlik narx */}
              {!restaurant && (
                <th scope="col" className="px-4 py-3.5">
                  {labels.priceLabel}
                </th>
              )}

              {/* Sotuvda */}
              <th scope="col" className="px-4 py-3.5 text-center">
                Sotuvda
              </th>

              {/* Amallar */}
              <th scope="col" className="w-24 px-4 py-3.5 text-right">
                Amallar
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
            {rooms.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    (isHostel ? 1 : 0) +
                    (!restaurant ? 1 : 0) +
                    6
                  }
                  className="py-16 text-center text-zinc-500 dark:text-zinc-400"
                >
                  <p className="text-sm font-medium">Mos keluvchi {labels.unitPlural.toLowerCase()} topilmadi</p>
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    Filtrlarni tozalang yoki yangi {labels.unitSingular.toLowerCase()} qo'shing.
                  </p>
                </td>
              </tr>
            ) : (
              rooms.map((room) => {
                const roomType = roomTypes.find((t) => t.id === room.roomTypeId);
                const roomBeds = isHostel ? beds.filter((b) => b.roomId === room.id) : [];
                const freeBeds = roomBeds.filter((b) => b.status === RoomStatus.VACANT_CLEAN).length;
                const isSelected = selectedRoomIds.has(room.id);
                const isUpdating = updatingRoomId === room.id;
                const price = room.nightlyPrice ?? roomType?.basePrice;

                return (
                  <tr
                    key={room.id}
                    className={cn(
                      "transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40",
                      isSelected && "bg-brand-50/40 dark:bg-brand-950/20",
                      !room.isListed && "opacity-80"
                    )}
                  >
                    {/* Checkbox */}
                    <td className="w-12 px-4 py-3 align-middle text-center">
                      <label
                        className="relative inline-flex items-center justify-center p-1 cursor-pointer"
                        title={`${room.number} tanlash`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleRoom(room.id)}
                          aria-label={`${room.number} tanlash`}
                          className="h-4 w-4 rounded-md border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-brand-600 cursor-pointer transition-colors"
                        />
                      </label>
                    </td>

                    {/* Xona raqami & turi */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditRoom(room)}
                          className="font-bold text-zinc-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 transition-colors focus-visible:outline-none focus-visible:underline text-sm"
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
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                        {formatUnitTypeName(room.roomTypeName || roomType?.name || "", labels) || "—"}
                      </div>
                    </td>

                    {/* Qavat */}
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {room.floor}-{labels.floorSingular}
                      </span>
                    </td>

                    {/* Sig'imi */}
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <Users className="h-3.5 w-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                        <span>
                          {roomType?.capacity || "?"} {labels.capacitySuffix}
                        </span>
                        {!restaurant && !isBus && roomType?.bedType && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">·</span>
                            <span className="truncate max-w-[120px] text-zinc-500 dark:text-zinc-400">
                              {roomType.bedType}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Yotoqlar */}
                    {isHostel && (
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onManageBeds(room)}
                          className="h-7 px-2 text-[11px] font-semibold gap-1 text-zinc-700 dark:text-zinc-300"
                        >
                          <BedSingle className="h-3 w-3 text-zinc-400" aria-hidden="true" />
                          <span>
                            {freeBeds}/{roomBeds.length} bo'sh
                          </span>
                        </Button>
                      </td>
                    )}

                    {/* Housekeeping holati */}
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      {isBus ? (
                        <div className="flex items-center gap-2">
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
                              onClick={() => onToggleBusStatus(room)}
                              disabled={isUpdating}
                              className="h-6 px-2 text-[10px] font-semibold"
                            >
                              {room.status === RoomStatus.OUT_OF_SERVICE ? "Faollashtirish" : "O'chirish"}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <select
                          id={`table-status-select-${room.id}`}
                          aria-label={`${room.number} ${labels.unitSingular.toLowerCase()} holati`}
                          value={room.status}
                          disabled={isUpdating}
                          onChange={(e) => onStatusChange(room, e.target.value as RoomStatus)}
                          className={cn(
                            "cursor-pointer rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20",
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
                          <option value={RoomStatus.VACANT_CLEAN}>✓ {labels.statusCleanLabel}</option>
                          <option value={RoomStatus.VACANT_DIRTY}>🧹 {labels.statusDirtyLabel}</option>
                          <option value={RoomStatus.OCCUPIED}>👤 {labels.statusOccupiedLabel}</option>
                          <option value={RoomStatus.OUT_OF_SERVICE}>🔧 {labels.statusOutOfServiceLabel}</option>
                          <option value={RoomStatus.BLOCKED}>🚫 Bloklangan</option>
                        </select>
                      )}
                    </td>

                    {/* Narx */}
                    {!restaurant && (
                      <td className="px-4 py-3 align-middle whitespace-nowrap">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white">
                          {price ? formatMoney(price) : "—"}
                        </span>
                      </td>
                    )}

                    {/* Sotuvda switch */}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={room.isListed}
                          disabled={isUpdating}
                          onChange={() => onToggleListed(room)}
                          aria-label={`${room.number} sotuvda ko'rsatish`}
                        />
                        <div className="w-8 h-4.5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500/30 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:border-zinc-600 peer-checked:bg-brand-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                      </label>
                    </td>

                    {/* Amallar */}
                    <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditRoom(room)}
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
                            <DropdownMenuItem onClick={() => onEditRoom(room)}>
                              <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                              <span>Tahrirlash</span>
                            </DropdownMenuItem>

                            {isHostel && (
                              <DropdownMenuItem onClick={() => onManageBeds(room)}>
                                <BedSingle className="h-3.5 w-3.5 text-zinc-500" />
                                <span>Joylarni boshqarish</span>
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem onClick={() => onToggleListed(room)}>
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

                            <DropdownMenuItem destructive onClick={() => onDeleteRoom(room)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              <span>O'chirish</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
