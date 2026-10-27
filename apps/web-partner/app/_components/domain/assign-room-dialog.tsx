"use client";

import { useMemo, useState } from "react";
import {
  CarFront,
  Check,
  DoorOpen,
  Filter,
  Search,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { useRooms } from "../../_hooks/use-rooms";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { useReservations, useAssignRoom } from "../../_hooks/use-reservations";
import { useVehicles } from "../../_hooks/use-vehicles";
import { RoomStatus, type ReservationView, type Room, type RoomType } from "../../_lib/domain/types";
import { cn } from "../../_lib/utils/cn";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, isRestaurant, hasBuses } from "../../_lib/utils/partner-labels";
import { DEFAULT_SLOT_DURATION_MINUTES, toMinutes } from "../../_lib/utils/time-slots";

interface Props {
  open: boolean;
  onClose: () => void;
  reservation: ReservationView | null;
  /** Xona tanlangandan keyingi harakat. */
  onAssigned?: (roomNumber: string) => void;
}

export function AssignRoomDialog(props: Props) {
  if (!props.open) return null;
  return <AssignRoomDialogContent key={props.reservation?.id ?? "dialog"} {...props} />;
}

function AssignRoomDialogContent({
  open,
  onClose,
  reservation,
  onAssigned,
}: Props) {
  const { data: roomsData = [] } = useRooms();
  const { data: vehiclesData = [] } = useVehicles();
  const { data: roomTypes = [] } = useRoomTypes();
  const { data: reservations = [] } = useReservations();
  const assignRoom = useAssignRoom();

  const [selected, setSelected] = useState<string | null>(reservation?.roomNumber ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOnlyAvailable, setFilterOnlyAvailable] = useState(false);

  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const floorCap = labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1);
  const restaurant = isRestaurant(partnerType);
  const isTransport = hasBuses(partnerType);
  const UnitIcon = isTransport ? CarFront : restaurant ? UtensilsCrossed : DoorOpen;

  const rooms = useMemo(() => {
    if (isTransport) {
      return vehiclesData.map(
        (v) =>
          ({
            id: v.id,
            number: v.plateNumber || v.name,
            floor: 1,
            roomTypeId: v.id,
            roomTypeName: v.name,
            isListed: v.status === "active",
            nightlyPrice: v.pricePerDay,
            status: RoomStatus.VACANT_CLEAN,
          }) as Room,
      );
    }
    return roomsData;
  }, [roomsData, vehiclesData, isTransport]);

  /**
   * Room.status faqat "hozir jismonan band"ni bildiradi.
   * Haqiqiy to'qnashuvni bron sanalari bo'yicha hisoblaymiz.
   */
  const isRoomAvailable = (room: Room): boolean => {
    if (!reservation) return false;

    if (!isTransport && room.roomTypeId !== reservation.roomTypeId) return false;

    const hasConflict = reservations.some((r) => {
      if (r.id === reservation.id || r.roomNumber !== room.number) return false;
      if (
        r.status === BookingStatus.CANCELLED ||
        r.status === BookingStatus.EXPIRED ||
        r.status === BookingStatus.COMPLETED
      ) {
        return false;
      }
      if (restaurant) {
        if (r.checkIn !== reservation.checkIn || !r.slotTime || !reservation.slotTime) {
          return false;
        }
        const existingStart = toMinutes(r.slotTime);
        const existingEnd = existingStart + DEFAULT_SLOT_DURATION_MINUTES;
        const targetStart = toMinutes(reservation.slotTime);
        const targetEnd = targetStart + DEFAULT_SLOT_DURATION_MINUTES;
        return targetStart < existingEnd && existingStart < targetEnd;
      }
      return r.checkIn < reservation.checkOut && reservation.checkIn < r.checkOut;
    });
    if (hasConflict) return false;

    if (restaurant || isTransport) {
      return room.status !== RoomStatus.OUT_OF_SERVICE && room.status !== RoomStatus.BLOCKED;
    }
    return room.status === RoomStatus.VACANT_CLEAN;
  };

  const availableRoomsCount = useMemo(() => {
    if (!reservation) return 0;
    return rooms.filter((r) => isRoomAvailable(r)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, reservations, reservation, restaurant]);

  // Qavatlar bo'yicha saralash va qidiruv filtrlash
  const floors = useMemo(() => {
    const filtered = rooms.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = r.number.toLowerCase().includes(q);
        const matchesType = r.roomTypeName?.toLowerCase().includes(q);
        if (!matchesNum && !matchesType) return false;
      }
      if (filterOnlyAvailable) {
        return isRoomAvailable(r);
      }
      return true;
    });

    const map = new Map<number, Room[]>();
    filtered.forEach((room) => {
      if (!map.has(room.floor)) {
        map.set(room.floor, []);
      }
      map.get(room.floor)!.push(room);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, floorRooms]) => ({
        floor,
        rooms: floorRooms.sort((a, b) => a.number.localeCompare(b.number)),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, searchQuery, filterOnlyAvailable, reservations, reservation]);

  const firstAvailableRoom = useMemo(() => {
    return rooms.find((r) => isRoomAvailable(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, reservations, reservation]);

  const assignAndClose = (roomNumber: string, auto: boolean) => {
    if (!reservation) return;
    assignRoom.mutate(
      { id: reservation.id, roomNumber },
      {
        onSuccess: () => {
          toast.success(
            auto
              ? `${unitCap} ${roomNumber} avtomatik tayinlandi.`
              : `${unitCap} ${roomNumber} muvaffaqiyatli tayinlandi.`,
          );
          onAssigned?.(roomNumber);
          setSelected(null);
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : `${unitCap} biriktirib bo'lmadi`);
        },
      },
    );
  };

  const handleAutoAssign = () => {
    if (!firstAvailableRoom) return;
    assignAndClose(firstAvailableRoom.number, true);
  };

  const handleConfirm = () => {
    if (!selected) return;
    assignAndClose(selected, false);
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Aqlli ${unitCap} biriktirish`}
      description={
        reservation
          ? `${reservation.guest.fullName} · Bron turi: ${reservation.roomTypeName}`
          : ""
      }
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
            {selected ? (
              <span>
                Tanlandi: <strong className="font-semibold text-slate-900 dark:text-zinc-100">{unitCap} {selected}</strong>
              </span>
            ) : (
              <span>Iltimos, ro'yxatdan {labels.unitSingular}ni tanlang</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={assignRoom.isPending}
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!selected || assignRoom.isPending}
              loading={assignRoom.isPending}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm transition-all"
            >
              {selected ? `${unitCap}ni biriktirish` : `${unitCap} tanlang`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Smart recommendation banner */}
        {reservation && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 backdrop-blur-sm dark:border-blue-900/40 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-2xs dark:bg-blue-900/60 dark:text-blue-300">
                <UnitIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Mos keladigan {availableRoomsCount} ta bo'sh {labels.unitSingular} bor
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                  Tizim talabga mos {labels.unitPlural}ni yashil rang bilan belgilab beradi.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAutoAssign}
              disabled={!firstAvailableRoom || assignRoom.isPending}
              loading={assignRoom.isPending}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm transition-all text-xs"
            >
              <Zap className="h-3.5 w-3.5 mr-1" aria-hidden />
              Avtomatik tayinlash
            </Button>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${unitCap} raqami bo'yicha qidirish...`}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <Button
            type="button"
            variant={filterOnlyAvailable ? "subtle" : "outline"}
            size="sm"
            onClick={() => setFilterOnlyAvailable((prev) => !prev)}
            className={cn(
              "h-9 px-3 text-xs font-medium",
              filterOnlyAvailable &&
                "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
            )}
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            <span>Faqat bo'sh {labels.unitPlural.toLowerCase()}</span>
          </Button>
        </div>

        {/* Rooms Grid Grouped by Floor */}
        <div className="flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-1.5 custom-scrollbar">
          {floors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UnitIcon className="h-10 w-10 text-slate-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Mos {labels.unitSingular} topilmadi
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Qidiruv so'zini o'zgartiring yoki filtrlarni tozalang.
              </p>
            </div>
          ) : (
            floors.map(({ floor, rooms: floorRooms }) => (
              <div key={floor} className="flex flex-col gap-3">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/90 bg-white/90 py-1.5 backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-900/90">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    {floor}-{floorCap}
                  </h3>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    {floorRooms.length} ta {labels.unitSingular}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {floorRooms.map((room) => {
                    const roomType = roomTypes.find((t) => t.id === room.roomTypeId);
                    const isMatch = isRoomAvailable(room);
                    const isSelected = selected === room.number;

                    return (
                      <SmartRoomOption
                        key={room.id}
                        room={room}
                        roomType={roomType}
                        isMatch={isMatch}
                        selected={isSelected}
                        capacitySuffix={labels.capacitySuffix}
                        onSelect={() => {
                          if (isMatch) setSelected(room.number);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}

function SmartRoomOption({
  room,
  roomType,
  isMatch,
  selected,
  capacitySuffix = "kishi",
  onSelect,
}: {
  room: Room;
  roomType?: RoomType;
  isMatch: boolean;
  selected: boolean;
  capacitySuffix?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isMatch}
      className={cn(
        "group relative flex flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
        selected
          ? "border-blue-600 bg-blue-50/90 shadow-md ring-2 ring-blue-500/25 dark:border-blue-500 dark:bg-blue-950/60 dark:ring-blue-500/40"
          : isMatch
            ? "border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/80 hover:shadow-2xs active:scale-[0.98] cursor-pointer dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
            : "border-slate-100 bg-slate-50/50 opacity-40 cursor-not-allowed grayscale dark:border-zinc-800 dark:bg-zinc-900/30",
      )}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs">
          <Check className="h-3 w-3" strokeWidth={3} />
        </div>
      )}

      <span
        className={cn(
          "font-mono text-xl font-bold leading-none tracking-tight",
          selected
            ? "text-blue-700 dark:text-blue-300"
            : isMatch
              ? "text-emerald-800 dark:text-emerald-300"
              : "text-slate-500 dark:text-zinc-500",
        )}
      >
        {room.number}
      </span>

      <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 line-clamp-1 mt-1">
        {room.roomTypeName || roomType?.name || "Oddiy"}
      </span>

      <div className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-slate-400 dark:text-zinc-500">
        <Users className="h-3 w-3 shrink-0" />
        <span>{roomType?.capacity || 2} {capacitySuffix}</span>
      </div>
    </button>
  );
}
