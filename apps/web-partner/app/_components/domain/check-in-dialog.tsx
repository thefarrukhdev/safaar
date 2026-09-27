"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { AssignBedDialog } from "./assign-bed-dialog";
import { AssignRoomDialog } from "./assign-room-dialog";
import { useAssignRoom } from "../../_hooks/use-reservations";
import { useRooms } from "../../_hooks/use-rooms";
import { useVehicles } from "../../_hooks/use-vehicles";
import { useAuthStore } from "../../_stores/auth-store";
import { hasBeds, isDacha, hasBuses } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
  reservation: ReservationView | null;
  onAssigned?: (roomNumber: string) => void;
}

/**
 * Check-in bosqichida qaysi "xona tanlash" oynasi ochilishini hal qiladi:
 * - dacha — hech qanday tanlov ko'rsatmaydi, yagona birlikka avtomatik tayinlaydi.
 * - hostel — yotoq tanlash oynasi.
 * - qolganlari — mavjud xona tanlash oynasi (o'zgarishsiz).
 */
export function CheckInDialog({ open, onClose, reservation, onAssigned }: Props) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const { data: vehicles, isLoading: vehiclesLoading } = useVehicles();
  const assignRoom = useAssignRoom();
  const dacha = isDacha(partnerType);
  const isBus = hasBuses(partnerType);
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !reservation) return;
    if (handledRef.current === reservation.id) return;
    
    if (dacha) {
      if (roomsLoading) return;
      const room = rooms.find((item) => item.isListed) ?? rooms[0];
      if (!room) {
        handledRef.current = reservation.id;
        toast.error("Avval dacha uchun real birlik yarating.");
        onClose();
        return;
      }

      handledRef.current = reservation.id;
      assignRoom.mutate(
        { id: reservation.id, roomNumber: room.number },
        {
          onSuccess: () => {
            onAssigned?.(room.number);
            onClose();
          },
        },
      );
      return;
    }

    if (isBus) {
      if (vehiclesLoading) return;
      // Transport uchun `roomTypeId` = `vehicle_id`
      const vehicle = vehicles.find((v) => v.id === reservation.roomTypeId);
      const roomNumber = vehicle?.plateNumber || reservation.roomNumber;
      
      if (!roomNumber) {
        handledRef.current = reservation.id;
        toast.error("Avtomobilning davlat raqami aniqlanmadi.");
        onClose();
        return;
      }

      handledRef.current = reservation.id;
      // Avtomobil tayinlash (assignRoom) kerak emas, chunki mijoz web-userdan
      // yoki walk-in orqali allaqachon bitta mashinani tanlagan. Biz faqat
      // to'g'ridan-to'g'ri check-in (board) ga o'tkazib yuboramiz.
      onAssigned?.(roomNumber);
      onClose();
      return;
    }
  }, [open, reservation, dacha, isBus, rooms, vehicles, roomsLoading, vehiclesLoading]);

  if (dacha || isBus) return null;

  if (hasBeds(partnerType)) {
    return (
      <AssignBedDialog
        open={open}
        onClose={onClose}
        reservation={reservation}
        onAssigned={onAssigned}
      />
    );
  }

  return (
    <AssignRoomDialog
      open={open}
      onClose={onClose}
      reservation={reservation}
      onAssigned={onAssigned}
    />
  );
}
