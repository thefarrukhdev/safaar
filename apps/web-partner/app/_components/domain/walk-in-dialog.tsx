"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { PhoneInput } from "../ui/phone-input";
import { Label } from "../ui/label";
import { TODAY_ISO } from "../../_lib/utils/date";
import { useAuthStore } from "../../_stores/auth-store";
import { useListing } from "../../_hooks/use-listing";
import { useRooms } from "../../_hooks/use-rooms";
import { useRoomTypes } from "../../_hooks/use-room-types";
import {
  useCreateWalkInReservation,
  useCreateWalkInVehicleReservation,
  useReservations,
} from "../../_hooks/use-reservations";
import { useVehicles } from "../../_hooks/use-vehicles";
import { getPartnerLabels, hasBuses, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";
import { DEFAULT_SLOT_DURATION_MINUTES, buildTimeSlots, toMinutes } from "../../_lib/utils/time-slots";
import {
  isValidPhone,
  maskPhone,
  normalizePhone,
} from "../../_lib/utils/phone";

const schema = z.object({
  fullName: z.string().min(2, "Ism kamida 2 belgi"),
  phone: z.string().refine(isValidPhone, "Telefon noto'g'ri"),
  roomTypeId: z.string().min(1, "Xona turini tanlang"),
  roomNumber: z.string().optional(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  slotTime: z.string().optional(),
  adults: z.number().int().min(1).max(8),
  children: z.number().int().min(0).max(8),
});

type Values = z.infer<typeof schema>;

function nightsBetween(a: string, b: string): number {
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface WalkInInitial {
  checkIn?: string;
  checkOut?: string;
  roomTypeId?: string;
  roomNumber?: string;
  /** Faqat hostel: kalendardan oldindan tanlangan yotoq. */
  bedId?: string;
  /** Faqat restoran: kalendardan oldindan tanlangan vaqt-slot ("HH:MM"). */
  slotTime?: string;
  /** Faqat Rent Car (isBus): oldindan tanlangan avtomobil. */
  vehicleId?: string;
}

interface WalkInDialogProps {
  open: boolean;
  onClose: () => void;
  /** Kalendar'dan kelganda — oldindan to'ldirish. */
  initialValues?: WalkInInitial;
}

export function WalkInDialog({
  open,
  onClose,
  initialValues,
}: WalkInDialogProps) {
  const { data: roomTypes } = useRoomTypes();
  const { data: rooms } = useRooms();
  const { data: reservations } = useReservations();
  const { data: listing } = useListing();
  const createReservation = useCreateWalkInReservation();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const dacha = isDacha(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);
  const { data: vehicles } = useVehicles();
  const createVehicleReservation = useCreateWalkInVehicleReservation();

  let timeSlots = restaurant
    ? buildTimeSlots(listing.checkInTime, listing.checkOutTime)
    : [];
  if (restaurant && timeSlots.length === 0) {
    timeSlots = buildTimeSlots("09:00", "23:59");
  }
  const dachaRoom = dacha ? rooms[0] : undefined;

  const defaultCheckIn = initialValues?.checkIn ?? TODAY_ISO;
  const defaultCheckOut =
    initialValues?.checkOut ?? addDaysIso(defaultCheckIn, 1);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      phone: "+998 ",
      roomTypeId: initialValues?.roomTypeId ?? roomTypes[0]?.id ?? "",
      roomNumber: initialValues?.roomNumber ?? initialValues?.vehicleId ?? "",
      checkIn: defaultCheckIn,
      checkOut: defaultCheckOut,
      slotTime: initialValues?.slotTime ?? timeSlots[0],
      adults: 2,
      children: 0,
    },
  });

  // Dialog ochilganda formani initial qiymatlar bilan yangilash
  useEffect(() => {
    if (open) {
      const ci = initialValues?.checkIn ?? TODAY_ISO;
      form.reset({
        fullName: "",
        phone: "+998 ",
        roomTypeId: initialValues?.roomTypeId ?? roomTypes[0]?.id ?? "",
        roomNumber: initialValues?.roomNumber ?? initialValues?.vehicleId ?? "",
        checkIn: ci,
        checkOut: restaurant ? ci : (initialValues?.checkOut ?? addDaysIso(ci, 1)),
        slotTime: initialValues?.slotTime ?? timeSlots[0],
        adults: 2,
        children: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues, form, roomTypes]);

  const watchedRoomTypeId = useWatch({ control: form.control, name: "roomTypeId" });
  const availableRooms = rooms.filter((r) => !watchedRoomTypeId || r.roomTypeId === watchedRoomTypeId);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (isBus) {
        if (!values.roomNumber) {
          toast.error("Avtomobilni tanlang");
          return;
        }
        if (new Date(values.checkOut).getTime() <= new Date(values.checkIn).getTime()) {
          toast.error(`${labels.checkOutLabel} ${labels.checkInLabel.toLowerCase()}dan keyin bo'lishi kerak`);
          return;
        }

        const created = await createVehicleReservation.mutateAsync({
          fullName: values.fullName,
          phone: normalizePhone(values.phone),
          vehicleId: values.roomNumber,
          checkIn: values.checkIn,
          checkOut: values.checkOut,
          adults: values.adults,
          children: values.children,
        });
        toast.success(`Bron yaratildi: ${created.id}`);
        form.reset();
        onClose();
        return;
      }

      const effectiveRoomTypeId = dacha
        ? (dachaRoom?.roomTypeId ?? values.roomTypeId)
        : values.roomTypeId;
      const effectiveRoomNumber = dacha
        ? dachaRoom?.number
        : (initialValues?.roomNumber ?? (values.roomNumber || undefined));

      const roomType =
        roomTypes.find((rt) => rt.id === effectiveRoomTypeId) ?? roomTypes[0];
      if (!roomType) {
        toast.error(`Avval ${labels.unitTypeLabel.toLowerCase()} yarating`);
        return;
      }
      if (dacha && !dachaRoom) {
        toast.error("Dacha uchun avval real narx va birlik yarating");
        return;
      }
      if (restaurant && !values.slotTime) {
        toast.error("Vaqtni tanlang");
        return;
      }
      if (restaurant && !effectiveRoomNumber) {
        toast.error(`${unitCap}ni tanlang`);
        return;
      }
      const checkOut = restaurant ? values.checkIn : values.checkOut;
      if (!restaurant && new Date(checkOut).getTime() <= new Date(values.checkIn).getTime()) {
        toast.error(`${labels.checkOutLabel} ${labels.checkInLabel.toLowerCase()}dan keyin bo'lishi kerak`);
        return;
      }
      const nights = nightsBetween(values.checkIn, checkOut);

      if (effectiveRoomNumber) {
        const activeConflicts = reservations.filter(
          (r) =>
            r.roomNumber === effectiveRoomNumber &&
            r.status !== BookingStatus.CANCELLED &&
            r.status !== BookingStatus.EXPIRED &&
            r.status !== BookingStatus.COMPLETED,
        );
        const hasConflict = restaurant
          ? activeConflicts.some((r) => {
              if (r.checkIn !== values.checkIn || !r.slotTime || !values.slotTime) return false;
              const existingStart = toMinutes(r.slotTime);
              const existingEnd = existingStart + DEFAULT_SLOT_DURATION_MINUTES;
              const newStart = toMinutes(values.slotTime);
              const newEnd = newStart + DEFAULT_SLOT_DURATION_MINUTES;
              return newStart < existingEnd && existingStart < newEnd;
            })
          : activeConflicts.some(
              (r) => r.checkIn < checkOut && values.checkIn < r.checkOut,
            );
        if (hasConflict) {
          toast.error(`Bu ${labels.unitSingular} tanlangan vaqtda band`);
          return;
        }
      }

      const selectedRoom = effectiveRoomNumber
        ? rooms.find((room) => room.number === effectiveRoomNumber)
        : null;
      const nightlyPrice = selectedRoom?.nightlyPrice ?? roomType.basePrice;
      const total = nightlyPrice * nights;

      const created = await createReservation.mutateAsync({
        fullName: values.fullName,
        phone: normalizePhone(values.phone),
        roomTypeId: effectiveRoomTypeId,
        roomNumber: effectiveRoomNumber,
        bedId: initialValues?.bedId,
        slotTime: restaurant ? values.slotTime : undefined,
        checkIn: values.checkIn,
        checkOut,
        adults: values.adults,
        children: values.children,
        nights,
        totalPrice: total,
      });

      toast.success(`Bron yaratildi: ${created.id}`);
      form.reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bron yaratib bo'lmadi");
    }
  });

  const err = form.formState.errors;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={labels.walkInTitle}
      description={
        isBus
          ? "Mijozga to'g'ridan-to'g'ri mashina ijaraga berish uchun."
          : "Resepsiyonga to'g'ridan-to'g'ri kelgan mehmon uchun."
      }
      size="lg"
    >
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label htmlFor="fullName">{isBus ? "Mijoz (Haydovchi) FIO" : "Mehmon FIO"}</Label>
          <Input
            id="fullName"
            placeholder="Aliyev Sherzod"
            aria-invalid={Boolean(err.fullName)}
            {...form.register("fullName")}
          />
          {err.fullName && (
            <p className="text-xs text-red-600">{err.fullName.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label htmlFor="phone">Telefon</Label>
          <PhoneInput
            id="phone"
            placeholder="+998 90 123 45 67"
            aria-invalid={Boolean(err.phone)}
            {...form.register("phone")}
          />
          {err.phone && (
            <p className="text-xs text-red-600">{err.phone.message}</p>
          )}
        </div>

        {!dacha && !isBus && (
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="roomTypeId">{labels.unitTypeLabel}</Label>
            <select
              id="roomTypeId"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
              {...form.register("roomTypeId")}
            >
              {roomTypes.length === 0 ? (
                <option value="">Avval {labels.unitTypeLabel.toLowerCase()}ni yarating</option>
              ) : (
                roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {restaurant
                      ? `${rt.capacity} kishilik`
                      : `${rt.name} — ${rt.basePrice.toLocaleString("uz-UZ")} so'm`}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {isBus && (
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="roomNumber">{labels.unitSingular}</Label>
            <select
              id="roomNumber"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
              {...form.register("roomNumber")}
            >
              <option value="">{`Mashinani tanlang`}</option>
              {vehicles.filter(v => v.status === 'active').map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plateNumber}) — {v.pricePerDay.toLocaleString("uz-UZ")} so'm
                </option>
              ))}
            </select>
          </div>
        )}

        {initialValues?.roomNumber || initialValues?.vehicleId ? (
          <div className="rounded-card border border-brand-200 bg-brand-50/60 px-3 py-2 text-sm text-brand-900 dark:border-brand-900/50 dark:bg-brand-950/25 dark:text-brand-100 md:col-span-2">
            <span className="font-semibold">Kalendar {labels.unitSingular}si:</span>{" "}
            {initialValues.roomNumber || vehicles?.find(v => v.id === initialValues?.vehicleId)?.name || initialValues.vehicleId}
          </div>
        ) : (
          !dacha && !isBus && (
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="roomNumber">{unitCap}</Label>
              <select
                id="roomNumber"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
                {...form.register("roomNumber")}
              >
                <option value="">{`${unitCap}ni tanlang ${restaurant ? '' : '(ixtiyoriy)'}`}</option>
                {availableRooms.map((r) => (
                  <option key={r.id} value={r.number}>
                    {r.number} {r.roomTypeName ? `(${r.roomTypeName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="checkIn">{restaurant ? "Sana" : labels.checkInLabel}</Label>
          <Input id="checkIn" type="date" {...form.register("checkIn")} />
        </div>

        {restaurant ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slotTime">Vaqt</Label>
            <select
              id="slotTime"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
              {...form.register("slotTime")}
            >
              {timeSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkOut">{labels.checkOutLabel}</Label>
            <Input id="checkOut" type="date" {...form.register("checkOut")} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="adults">{restaurant ? "Kishilar soni" : "Kattalar"}</Label>
          <Input
            id="adults"
            type="number"
            min={1}
            max={8}
            {...form.register("adults", { valueAsNumber: true })}
          />
        </div>

        {!restaurant && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="children">Bolalar</Label>
            <Input
              id="children"
              type="number"
              min={0}
              max={8}
              {...form.register("children", { valueAsNumber: true })}
            />
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            disabled={createReservation.isPending || createVehicleReservation.isPending}
            loading={createReservation.isPending || createVehicleReservation.isPending}
          >
            Bron yaratish
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
