"use client";

import { Users, Sparkles, Check, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { useRooms } from "../../_hooks/use-rooms";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { useReservations, useAssignRoom } from "../../_hooks/use-reservations";
import { RoomStatus, type ReservationView, type Room, type RoomType } from "../../_lib/domain/types";
import { cn } from "../../_lib/utils/cn";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, isRestaurant, hasBuses } from "../../_lib/utils/partner-labels";
import { DEFAULT_SLOT_DURATION_MINUTES, toMinutes } from "../../_lib/utils/time-slots";
import { useVehicles } from "../../_hooks/use-vehicles";

interface Props {
  open: boolean;
  onClose: () => void;
  reservation: ReservationView | null;
  /** Xona tanlangandan keyingi harakat. */
  onAssigned?: (roomNumber: string) => void;
}

export function AssignRoomDialog({
  open,
  onClose,
  reservation,
  onAssigned,
}: Props) {
  const { data: roomsData } = useRooms();
  const { data: vehiclesData } = useVehicles();
  const { data: roomTypes } = useRoomTypes();
  const { data: reservations } = useReservations();
  const assignRoom = useAssignRoom();
  const [selected, setSelected] = useState<string | null>(null);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const floorCap = labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1);
  const restaurant = isRestaurant(partnerType);
  const isTransport = hasBuses(partnerType);

  const rooms = useMemo(() => {
    if (isTransport) {
      return vehiclesData.map(v => ({
        id: v.id,
        number: v.plateNumber || v.name,
        floor: 1,
        roomTypeId: v.id, 
        roomTypeName: v.name,
        isListed: v.status === 'active',
        nightlyPrice: v.pricePerDay,
        status: RoomStatus.VACANT_CLEAN
      } as Room));
    }
    return roomsData;
  }, [roomsData, vehiclesData, isTransport]);

  /**
   * Room.status faqat "hozir jismonan band"ni bildiradi — kecha/vaqt-slot
   * darajasidagi haqiqiy to'qnashuvni emas. Shu sabab bo'sh joyni aniqlashda
   * ayni shu bron bilan ustma-ust tushadigan boshqa faol bronlarni ham
   * tekshiramiz (restoranda vaqt-slot, boshqalarida sana oralig'i bo'yicha).
   */
  const isRoomAvailable = (room: Room): boolean => {
    if (!reservation) return false;
    
    // Har doim, shu jumladan transport uchun ham, bron qilingan "roomType" (avtomobil ID)
    // bilan tanlanayotgan avtomobil IDsi ustma-ust tushishi kerak.
    if (room.roomTypeId !== reservation.roomTypeId) return false;

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

    // Restoranda stol holati faqat "hozir band o'tirilgan"ni bildiradi, kunlik
    // vaqt-slotlarni emas — shuning uchun faqat ta'mirdagi stollarni chetlab
    // o'tamiz. Boshqalarida odatiy uy xo'jaligi holati talab qilinadi.
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

  // Qavatlar bo'yicha xaritalash
  const floors = useMemo(() => {
    const map = new Map<number, Room[]>();
    rooms.forEach(room => {
      if (!map.has(room.floor)) {
        map.set(room.floor, []);
      }
      map.get(room.floor)!.push(room);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, floorRooms]) => {
        return {
          floor,
          rooms: floorRooms.sort((a, b) => a.number.localeCompare(b.number))
        };
      });
  }, [rooms]);

  // Xaritada birinchi ko'rinadigan mos xona — "Avtomatik tayinlash" shu bilan
  // ishlaydi, natija odam qo'lda tanlaganida kutadigan tanlov bilan bir xil.
  const firstAvailableRoom = floors
    .flatMap((f) => f.rooms)
    .find((r) => isRoomAvailable(r));

  const assignAndClose = (roomNumber: string, auto: boolean) => {
    if (!reservation) return;
    assignRoom.mutate({ id: reservation.id, roomNumber }, {
      onSuccess: () => {
        toast.success(
          auto
            ? `${unitCap} ${roomNumber} avtomatik tayinlandi.`
            : `${unitCap} ${roomNumber} muvaffaqiyatli tayinlandi.`,
        );
        onAssigned?.(roomNumber);
        setSelected(null);
        onClose();
      }
    });
  };

  const handleAutoAssign = () => {
    if (!firstAvailableRoom) return;
    assignAndClose(firstAvailableRoom.number, true);
  };

  const handleConfirm = () => {
    if (!selected) return;
    assignAndClose(selected, false);
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setSelected(null);
        onClose();
      }}
      title={`Aqlli ${unitCap} Tayinlash`}
      description={
        reservation
          ? `${reservation.guest.fullName} · Bron: ${reservation.roomTypeName}`
          : ""
      }
      size="lg" // xaritani sig'dirish uchun kattaroq oyna
    >
      <div className="flex flex-col gap-6">
        
        {/* Info panel */}
        {reservation && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-brand-50 p-4 border border-brand-100 dark:bg-brand-900/20 dark:border-brand-900/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
                  Mos keladigan {availableRoomsCount} ta bo'sh {labels.unitSingular} bor
                </p>
                <p className="text-xs text-brand-700 dark:text-brand-300">
                  Tizim avtomatik ravishda mos {labels.unitPlural}ni yashil rangda ko'rsatmoqda.
                </p>
              </div>
            </div>
            <Button
              onClick={handleAutoAssign}
              disabled={!firstAvailableRoom || assignRoom.isPending}
              loading={assignRoom.isPending}
            >
              <Zap className="h-4 w-4" aria-hidden />
              Avtomatik tayinlash
            </Button>
          </div>
        )}

        {reservation && (
          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
            <div className="h-px flex-1 bg-[var(--border)]" />
            yoki qo'lda tanlang
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>
        )}

        <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {floors.map(({ floor, rooms }) => (
            <div key={floor} className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800 pb-1">
                {floor}-{floorCap}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {rooms.map((room) => {
                  const roomType = roomTypes.find(t => t.id === room.roomTypeId);
                  const isMatch = isRoomAvailable(room);
                  return (
                    <SmartRoomOption
                      key={room.id}
                      room={room}
                      roomType={roomType}
                      isMatch={isMatch}
                      selected={selected === room.number}
                      onSelect={() => {
                        if (isMatch) {
                          setSelected(room.number);
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--border)] pt-5">
          <Button variant="outline" onClick={onClose} disabled={assignRoom.isPending}>
            Bekor qilish
          </Button>
          <Button onClick={handleConfirm} disabled={!selected} loading={assignRoom.isPending}>
            {selected ? `Tayinlash` : `${unitCap} tanlang`}
          </Button>
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
  onSelect,
}: {
  room: Room;
  roomType?: RoomType;
  isMatch: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const isAvailable = isMatch;
  
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isAvailable}
      className={cn(
        "relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-200",
        // Tanlangan bo'lsa
        selected
          ? "border-brand-500 bg-brand-50 shadow-md ring-1 ring-brand-500 dark:bg-brand-900/40 dark:border-brand-400 dark:ring-brand-400"
          : isMatch
            ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm cursor-pointer dark:bg-emerald-900/10 dark:border-emerald-900/60 dark:hover:bg-emerald-900/20"
            : "border-zinc-100 bg-zinc-50/50 opacity-40 cursor-not-allowed grayscale dark:border-zinc-800 dark:bg-zinc-900/30"
      )}
    >
      {selected && (
        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </div>
      )}
      
      <span className={cn(
        "font-mono text-xl font-black leading-none",
        selected ? "text-brand-700 dark:text-brand-300" 
        : isMatch ? "text-emerald-700 dark:text-emerald-400"
        : "text-zinc-600 dark:text-zinc-400"
      )}>
        {room.number}
      </span>
      
      <span className="text-[10px] font-semibold text-zinc-500 mt-1 line-clamp-1">
        {room.roomTypeName}
      </span>
      
      <div className="flex items-center gap-1.5 mt-1 text-[10px] font-medium text-zinc-400">
        <Users className="h-3 w-3" />
        {roomType?.capacity || "?"} kishi
      </div>
    </button>
  );
}
