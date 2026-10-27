"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  LogIn,
  Moon,
  Phone,
  User,
  Zap,
} from "lucide-react";
import { AssignBedDialog } from "./assign-bed-dialog";
import { AssignRoomDialog } from "./assign-room-dialog";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { useAssignRoom } from "../../_hooks/use-reservations";
import { useRooms } from "../../_hooks/use-rooms";
import { useVehicles } from "../../_hooks/use-vehicles";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBeds, hasBuses, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
  reservation: ReservationView | null;
  onAssigned?: (roomNumber: string) => void;
}

/**
 * Modern Apple/Linear Check-in dialog with a11y, tactile interactions,
 * clear guest summary and smart room assignment routing.
 */
export function CheckInDialog({ open, onClose, reservation, onAssigned }: Props) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const dacha = isDacha(partnerType);
  const isBus = hasBuses(partnerType);
  const restaurant = isRestaurant(partnerType);

  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: vehicles = [], isLoading: vehiclesLoading } = useVehicles();
  const assignRoom = useAssignRoom();

  const [isReassigning, setIsReassigning] = useState(false);

  // Determine existing or auto-inferred room/unit
  const existingRoomNumber = useMemo(() => {
    if (!reservation) return "";
    if (reservation.roomNumber) return reservation.roomNumber;

    if (dacha) {
      const room = rooms.find((item) => item.isListed) ?? rooms[0];
      return room?.number ?? "";
    }

    if (isBus) {
      const vehicle = vehicles.find((v) => v.id === reservation.roomTypeId);
      return vehicle?.plateNumber || vehicle?.name || "";
    }

    return "";
  }, [reservation, dacha, isBus, rooms, vehicles]);

  // If dialog closes, reset reassign state
  const handleClose = () => {
    setIsReassigning(false);
    onClose();
  };

  const handleReassignCancel = () => {
    if (existingRoomNumber) {
      setIsReassigning(false);
    } else {
      handleClose();
    }
  };

  if (!open || !reservation) return null;

  // If the user requested to reassign or if no room is assigned yet (for hotel/hostel), show selection dialogs
  if ((!existingRoomNumber && !dacha && !isBus) || isReassigning) {
    if (hasBeds(partnerType)) {
      return (
        <AssignBedDialog
          open={open}
          onClose={handleReassignCancel}
          reservation={reservation}
          onAssigned={(roomNum) => {
            setIsReassigning(false);
            onAssigned?.(roomNum);
            onClose();
          }}
        />
      );
    }

    return (
      <AssignRoomDialog
        open={open}
        onClose={handleReassignCancel}
        reservation={reservation}
        onAssigned={(roomNum) => {
          setIsReassigning(false);
          onAssigned?.(roomNum);
          onClose();
        }}
      />
    );
  }

  // Handle direct Check-In confirmation
  const handleConfirmCheckIn = async () => {
    if (dacha && !existingRoomNumber) {
      if (roomsLoading) return;
      toast.error("Avval dacha uchun xona/birlik yarating.");
      return;
    }

    if (isBus && !existingRoomNumber) {
      if (vehiclesLoading) return;
      toast.error("Avtomobil aniqlanmadi.");
      return;
    }

    // For dacha, ensure unit is officially assigned if needed
    if (dacha && reservation && existingRoomNumber && !reservation.roomNumber) {
      try {
        await assignRoom.mutateAsync({
          id: reservation.id,
          roomNumber: existingRoomNumber,
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xona biriktirishda xatolik");
        return;
      }
    }

    onAssigned?.(existingRoomNumber);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`${labels.checkInLabel} qilish`}
      description={`${labels.guestLabel}ni qabul qilish va ma'lumotlarni tasdiqlash`}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {!dacha && !isBus && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReassigning(true)}
                className="text-xs text-slate-600 dark:text-zinc-300"
              >
                <Zap className="h-3.5 w-3.5 mr-1 text-amber-500" />
                {unitCap}ni almashtirish
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Bekor qilish
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCheckIn}
              disabled={assignRoom.isPending}
              loading={assignRoom.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-sm transition-all"
            >
              <LogIn className="h-4 w-4 mr-1.5" />
              {labels.checkInLabel} qilish
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Guest Summary Card */}
        <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-2xs dark:bg-blue-950/60 dark:text-blue-400">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-zinc-100">
                  {reservation.guest.fullName}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                  <Phone className="h-3 w-3" />
                  <span>{reservation.guest.phone || "Telefon ko'rsatilmagan"}</span>
                </div>
              </div>
            </div>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
              #{reservation.id.slice(0, 8)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
              <DoorOpen className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <div className="truncate">
                <span className="text-slate-400 dark:text-zinc-500">{unitCap}: </span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100">
                  {existingRoomNumber || "Belgilanmagan"}
                </span>
                {reservation.roomTypeName && (
                  <span className="ml-1 text-[11px] text-slate-500">({reservation.roomTypeName})</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
              {restaurant ? (
                <>
                  <Clock className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                  <span>{reservation.slotTime || "Vaqt belgilanmagan"}</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                  <span>{reservation.nights} {isBus ? "kun" : "kecha"}</span>
                </>
              )}
            </div>

            <div className="col-span-2 flex items-center gap-2 text-slate-600 dark:text-zinc-300">
              <Calendar className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0" />
              <span>
                {reservation.checkIn} → {reservation.checkOut}
              </span>
            </div>
          </div>
        </div>

        {/* Status banner */}
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{unitCap} tayyorlangan va {labels.guestLabel.toLowerCase()}ni qabul qilishga tayyor.</span>
        </div>
      </div>
    </Dialog>
  );
}
