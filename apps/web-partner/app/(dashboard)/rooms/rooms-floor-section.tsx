"use client";

import { useEffect, useMemo, useRef } from "react";
import { RoomStatus, type Bed, type Room, type RoomType } from "../../_lib/domain/types";
import { type PartnerLabels, getRestaurantHallName } from "../../_lib/utils/partner-labels";
import { cn } from "../../_lib/utils/cn";
import { RoomCard } from "./room-card";

export interface RoomsFloorSectionProps {
  floor: number;
  rooms: Room[];
  roomTypes: RoomType[];
  beds: Bed[];
  isHostel: boolean;
  restaurant: boolean;
  isBus: boolean;
  labels: PartnerLabels | any;
  selectedRoomIds: Set<string>;
  onToggleRoom: (id: string) => void;
  onToggleFloor: (floor: number, roomIds: string[]) => void;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onManageBeds: (room: Room) => void;
  onStatusChange: (room: Room, status: RoomStatus) => void;
  onToggleListed: (room: Room) => void;
  onToggleBusStatus?: (room: Room) => void;
  updatingRoomId: string | null;
}

export function RoomsFloorSection({
  floor,
  rooms,
  roomTypes,
  beds,
  isHostel,
  restaurant,
  isBus,
  labels,
  selectedRoomIds,
  onToggleRoom,
  onToggleFloor,
  onEditRoom,
  onDeleteRoom,
  onManageBeds,
  onStatusChange,
  onToggleListed,
  onToggleBusStatus,
  updatingRoomId,
}: RoomsFloorSectionProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const roomIds = useMemo(() => rooms.map((r) => r.id), [rooms]);

  const cleanCount = useMemo(
    () => rooms.filter((r) => r.status === RoomStatus.VACANT_CLEAN).length,
    [rooms]
  );
  const occupiedCount = useMemo(
    () => rooms.filter((r) => r.status === RoomStatus.OCCUPIED).length,
    [rooms]
  );

  const selectedCountOnFloor = useMemo(
    () => rooms.filter((r) => selectedRoomIds.has(r.id)).length,
    [rooms, selectedRoomIds]
  );

  const isAllSelected = rooms.length > 0 && selectedCountOnFloor === rooms.length;
  const isIndeterminate = selectedCountOnFloor > 0 && selectedCountOnFloor < rooms.length;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  return (
    <section
      aria-label={`${floor}-${labels.floorSingular}`}
      className="flex flex-col gap-4"
    >
      {/* Qavat sarlavhasi, ko'rsatkichlar va Qavatni tanlash */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 pb-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white capitalize">
            {restaurant ? `${getRestaurantHallName(floor)} (${floor}-zal)` : `${floor}-${labels.floorSingular}`}
          </h2>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {rooms.length} ta {labels.unitSingular}
            </span>
            {!isBus && (
              <>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {cleanCount} {labels.isRestaurant ? "tayyor" : labels.isBus ? "bo'sh" : "toza"}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {occupiedCount} {labels.isRestaurant ? "band" : labels.isBus ? "ijarada" : "band"}
                </span>
              </>
            )}
          </div>
        </div>

        <div>
          <label
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all duration-150 select-none",
              isAllSelected
                ? "border-brand-500/60 bg-brand-50/70 text-brand-700 dark:border-brand-500/40 dark:bg-brand-950/30 dark:text-brand-300"
                : isIndeterminate
                  ? "border-brand-300/80 bg-brand-50/30 text-brand-700 dark:border-brand-800 dark:bg-brand-950/20 dark:text-brand-300"
                  : "border-zinc-200/80 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            )}
            title={`${floor}-${labels.floorSingular}dagi barcha ${labels.unitPlural.toLowerCase()}ni tanlash`}
          >
            <input
              type="checkbox"
              ref={checkboxRef}
              checked={isAllSelected}
              onChange={() => onToggleFloor(floor, roomIds)}
              aria-label={`${floor}-${labels.floorSingular}dagi barcha ${labels.unitPlural.toLowerCase()}ni tanlash`}
              className="h-4 w-4 rounded-md border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-brand-600 cursor-pointer transition-colors"
            />
            <span>
              {isAllSelected
                ? "Tanlovni bekor qilish"
                : isIndeterminate
                  ? `${selectedCountOnFloor}/${rooms.length} tanlangan`
                  : `${labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}ni tanlash`}
            </span>
          </label>
        </div>
      </div>

      {/* Xonalar to'ri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {rooms.map((room) => {
          const roomType = roomTypes.find((t) => t.id === room.roomTypeId);
          const roomBeds = isHostel ? beds.filter((b) => b.roomId === room.id) : undefined;
          return (
            <RoomCard
              key={room.id}
              room={room}
              roomType={roomType}
              beds={roomBeds}
              restaurant={restaurant}
              isBus={isBus}
              onEdit={() => onEditRoom(room)}
              onDelete={() => onDeleteRoom(room)}
              onManageBeds={isHostel ? () => onManageBeds(room) : undefined}
              onStatusChange={(status) => onStatusChange(room, status)}
              onToggleListed={() => onToggleListed(room)}
              onToggleBusStatus={onToggleBusStatus ? () => onToggleBusStatus(room) : undefined}
              isUpdating={updatingRoomId === room.id}
              labels={labels}
              isSelected={selectedRoomIds.has(room.id)}
              onToggleSelect={() => onToggleRoom(room.id)}
            />
          );
        })}
      </div>
    </section>
  );
}
