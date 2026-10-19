"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import {
  CalendarDays,
  Clock,
  CreditCard,
  Minus,
  Moon,
  Plus,
  UserCheck,
  Users,
} from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { PhoneInput } from "../ui/phone-input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
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
import {
  isValidPhone,
  normalizePhone,
} from "../../_lib/utils/phone";
import { DEFAULT_SLOT_DURATION_MINUTES, buildTimeSlots, toMinutes } from "../../_lib/utils/time-slots";

const schema = z.object({
  fullName: z.string().min(2, "Ism kamida 2 ta belgidan iborat bo'lishi kerak"),
  phone: z.string().refine(isValidPhone, "Telefon raqami noto'g'ri"),
  roomTypeId: z.string().min(1, "Xona turini tanlang"),
  roomNumber: z.string().optional(),
  checkIn: z.string().min(1, "Kelish sanasini tanlang"),
  checkOut: z.string().min(1, "Ketish sanasini tanlang"),
  slotTime: z.string().optional(),
  adults: z.number().int().min(1, "Kamida 1 nafar").max(10, "Maksimal 10 nafar"),
  children: z.number().int().min(0).max(10),
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
  /** Mehmon ismi (CRM yoki mehmonlar profilidan ochilganda) */
  fullName?: string;
  /** Mehmon telefoni (CRM yoki mehmonlar profilidan ochilganda) */
  phone?: string;
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
  const { data: roomTypes = [] } = useRoomTypes();
  const { data: rooms = [] } = useRooms();
  const { data: reservations = [] } = useReservations();
  const { data: listing } = useListing();
  const createReservation = useCreateWalkInReservation();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const dacha = isDacha(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);
  const { data: vehicles = [] } = useVehicles();
  const createVehicleReservation = useCreateWalkInVehicleReservation();

  let timeSlots = restaurant
    ? buildTimeSlots(listing?.checkInTime, listing?.checkOutTime)
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
      fullName: initialValues?.fullName ?? "",
      phone: initialValues?.phone ?? "+998 ",
      roomTypeId: initialValues?.roomTypeId ?? roomTypes[0]?.id ?? "",
      roomNumber: initialValues?.vehicleId ?? initialValues?.roomNumber ?? "",
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
        fullName: initialValues?.fullName ?? "",
        phone: initialValues?.phone ?? "+998 ",
        roomTypeId: initialValues?.roomTypeId ?? roomTypes[0]?.id ?? "",
        roomNumber: initialValues?.vehicleId ?? initialValues?.roomNumber ?? "",
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
  const watchedRoomNumber = useWatch({ control: form.control, name: "roomNumber" });
  const watchedCheckIn = useWatch({ control: form.control, name: "checkIn" }) ?? defaultCheckIn;
  const watchedCheckOut = useWatch({ control: form.control, name: "checkOut" }) ?? defaultCheckOut;
  const watchedAdults = useWatch({ control: form.control, name: "adults" }) ?? 1;
  const watchedChildren = useWatch({ control: form.control, name: "children" }) ?? 0;
  const watchedSlotTime = useWatch({ control: form.control, name: "slotTime" });

  const availableRooms = useMemo(() => {
    return rooms.filter((r) => !watchedRoomTypeId || r.roomTypeId === watchedRoomTypeId);
  }, [rooms, watchedRoomTypeId]);

  // Live price calculation
  const liveCalculation = useMemo(() => {
    if (isBus) {
      const vehicle = vehicles.find((v) => v.id === watchedRoomNumber);
      const days = nightsBetween(watchedCheckIn, watchedCheckOut);
      const total = (vehicle?.pricePerDay ?? 0) * days;
      return { days, total, unitName: vehicle?.name };
    }

    const nights = restaurant ? 1 : nightsBetween(watchedCheckIn, watchedCheckOut);
    const selectedRoom = rooms.find((r) => r.number === watchedRoomNumber);
    const selectedType = roomTypes.find((t) => t.id === watchedRoomTypeId);
    const unitPrice = selectedRoom?.nightlyPrice ?? selectedType?.basePrice ?? 0;
    const total = unitPrice * nights;
    return {
      days: nights,
      total,
      unitName: selectedRoom ? `${selectedRoom.number} (${selectedRoom.roomTypeName})` : selectedType?.name,
    };
  }, [
    isBus,
    restaurant,
    vehicles,
    rooms,
    roomTypes,
    watchedRoomNumber,
    watchedRoomTypeId,
    watchedCheckIn,
    watchedCheckOut,
  ]);

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
          fullName: values.fullName.trim(),
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
        fullName: values.fullName.trim(),
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

      toast.success(`Bron muvaffaqiyatli yaratildi: #${created.id.slice(0, 8)}`);
      form.reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bron yaratib bo'lmadi");
    }
  });

  const err = form.formState.errors;
  const isSubmitting = createReservation.isPending || createVehicleReservation.isPending;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={labels.walkInTitle}
      description={
        isBus
          ? "Mijozga joyida avtomobil ijaraga berish uchun."
          : "Resepsiyonga to'g'ridan-to'g'ri kelgan mehmon uchun tezkor bron yaratish."
      }
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="text-left text-xs">
            <span className="text-slate-500 dark:text-zinc-400 mr-1.5">Taxminiy to'lov:</span>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
              {liveCalculation.total > 0
                ? `${liveCalculation.total.toLocaleString("uz-UZ")} so'm`
                : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Bekor qilish
            </Button>
            <Button
              type="submit"
              form="walk-in-form"
              disabled={isSubmitting}
              loading={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm transition-all"
            >
              <UserCheck className="h-4 w-4 mr-1.5" />
              Bron yaratish
            </Button>
          </div>
        </div>
      }
    >
      <form id="walk-in-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Guest Full Name */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="fullName">{isBus ? "Mijoz (Haydovchi) FIO" : "Mehmon FIO"}</Label>
            <Input
              id="fullName"
              placeholder="Masalan: Sherzod Aliyev"
              aria-invalid={Boolean(err.fullName)}
              aria-describedby={err.fullName ? "fullName-error" : undefined}
              className="h-11 text-base sm:text-sm"
              {...form.register("fullName")}
            />
            {err.fullName && (
              <p id="fullName-error" className="text-xs text-red-600 dark:text-red-400">
                {err.fullName.message}
              </p>
            )}
          </div>

          {/* Phone input with mobile 44px touch target */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="phone">Telefon raqami</Label>
            <PhoneInput
              id="phone"
              placeholder="+998 90 123 45 67"
              aria-invalid={Boolean(err.phone)}
              aria-describedby={err.phone ? "phone-error" : undefined}
              className="h-11 text-base sm:text-sm"
              {...form.register("phone")}
            />
            {err.phone && (
              <p id="phone-error" className="text-xs text-red-600 dark:text-red-400">
                {err.phone.message}
              </p>
            )}
          </div>

          {/* Room Type Selector (non-dacha, non-bus) */}
          {!dacha && !isBus && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="roomTypeId">{labels.unitTypeLabel}</Label>
              <Select
                id="roomTypeId"
                value={watchedRoomTypeId}
                error={Boolean(err.roomTypeId)}
                aria-describedby={err.roomTypeId ? "roomTypeId-error" : undefined}
                className="h-11"
                onChange={(e) =>
                  form.setValue("roomTypeId", e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                {roomTypes.length === 0 ? (
                  <option value="">Avval {labels.unitTypeLabel.toLowerCase()}ni yarating</option>
                ) : (
                  roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {restaurant
                        ? `${rt.capacity} kishilik (${rt.name})`
                        : `${rt.name} — ${rt.basePrice.toLocaleString("uz-UZ")} so'm/kecha`}
                    </option>
                  ))
                )}
              </Select>
              {err.roomTypeId && (
                <p id="roomTypeId-error" className="text-xs text-red-600 dark:text-red-400">
                  {err.roomTypeId.message}
                </p>
              )}
            </div>
          )}

          {/* Vehicle selector for rent car */}
          {isBus && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="roomNumber">{labels.unitSingular}</Label>
              <Select
                id="roomNumber"
                value={watchedRoomNumber}
                error={Boolean(err.roomNumber)}
                className="h-11"
                onChange={(e) =>
                  form.setValue("roomNumber", e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <option value="">Avtomobilni tanlang</option>
                {vehicles
                  .filter((v) => v.status === "active")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.plateNumber}) — {v.pricePerDay.toLocaleString("uz-UZ")} so'm/kun
                    </option>
                  ))}
              </Select>
            </div>
          )}

          {/* Specific Unit / Room selector (optional or calendar prefill) */}
          {initialValues?.roomNumber || initialValues?.vehicleId ? (
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3 text-sm text-brand-900 backdrop-blur-sm dark:border-brand-900/50 dark:bg-brand-950/30 dark:text-brand-100 sm:col-span-2 flex items-center justify-between">
              <div>
                <span className="font-semibold">Kalendardan tanlangan {labels.unitSingular}:</span>{" "}
                <span className="font-mono font-bold">
                  {initialValues.roomNumber ||
                    vehicles?.find((v) => v.id === initialValues?.vehicleId)?.name ||
                    initialValues.vehicleId}
                </span>
              </div>
            </div>
          ) : (
            !dacha &&
            !isBus && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label htmlFor="roomNumber">{unitCap}</Label>
                <Select
                  id="roomNumber"
                  value={watchedRoomNumber}
                  error={Boolean(err.roomNumber)}
                  className="h-11"
                  onChange={(e) =>
                    form.setValue("roomNumber", e.target.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  <option value="">{`${unitCap}ni tanlang ${restaurant ? "" : "(ixtiyoriy — avtomatik)"}`}</option>
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.number}>
                      {r.number} {r.roomTypeName ? `(${r.roomTypeName})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            )
          )}

          {/* Check-in date / Restaurant date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkIn" className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              {restaurant ? "Sana" : labels.checkInLabel}
            </Label>
            <Input
              id="checkIn"
              type="date"
              className="h-11"
              {...form.register("checkIn")}
            />
          </div>

          {/* Slot time or Check-out date */}
          {restaurant ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slotTime" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                Vaqt (Slot)
              </Label>
              <Select
                id="slotTime"
                value={watchedSlotTime}
                className="h-11"
                onChange={(e) =>
                  form.setValue("slotTime", e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="checkOut" className="flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                {labels.checkOutLabel}
              </Label>
              <Input
                id="checkOut"
                type="date"
                className="h-11"
                {...form.register("checkOut")}
              />
            </div>
          )}

          {/* Mobile-friendly tactile Steppers for Guests */}
          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              {restaurant ? "Kishilar soni" : "Kattalar"}
            </Label>
            <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-2 dark:border-zinc-800 dark:bg-zinc-900/80">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => form.setValue("adults", Math.max(1, watchedAdults - 1))}
                disabled={watchedAdults <= 1}
                className="h-8 w-9 min-h-0 min-w-0 p-0"
                aria-label="Kattalar sonini kamaytirish"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                {watchedAdults} kishi
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => form.setValue("adults", Math.min(10, watchedAdults + 1))}
                disabled={watchedAdults >= 10}
                className="h-8 w-9 min-h-0 min-w-0 p-0"
                aria-label="Kattalar sonini oshirish"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!restaurant && (
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                Bolalar
              </Label>
              <div className="flex h-11 items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-2 dark:border-zinc-800 dark:bg-zinc-900/80">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => form.setValue("children", Math.max(0, watchedChildren - 1))}
                  disabled={watchedChildren <= 0}
                  className="h-8 w-9 min-h-0 min-w-0 p-0"
                  aria-label="Bolalar sonini kamaytirish"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-sm text-slate-900 dark:text-zinc-100">
                  {watchedChildren} bola
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => form.setValue("children", Math.min(10, watchedChildren + 1))}
                  disabled={watchedChildren >= 10}
                  className="h-8 w-9 min-h-0 min-w-0 p-0"
                  aria-label="Bolalar sonini oshirish"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Live pricing and duration summary banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-blue-900 backdrop-blur-sm dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              {restaurant ? (
                <>Slot vaqti: <strong className="font-semibold">{watchedSlotTime || "Tanlanmagan"}</strong></>
              ) : (
                <>Muddat: <strong className="font-semibold">{liveCalculation.days} kecha</strong></>
              )}
              {liveCalculation.unitName && (
                <span className="ml-1 text-blue-700 dark:text-blue-300">
                  · {liveCalculation.unitName}
                </span>
              )}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 dark:text-zinc-400 mr-1.5">Taxminiy to'lov:</span>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
              {liveCalculation.total > 0
                ? `${liveCalculation.total.toLocaleString("uz-UZ")} so'm`
                : "—"}
            </span>
          </div>
        </div>

      </form>
    </Dialog>
  );
}
