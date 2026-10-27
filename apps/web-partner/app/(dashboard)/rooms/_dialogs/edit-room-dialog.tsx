"use client";

import { Edit3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Dialog } from "../../../_components/ui/dialog";
import { Input } from "../../../_components/ui/input";
import { MoneyInput } from "../../../_components/ui/money-input";
import { Label } from "../../../_components/ui/label";
import { Select } from "../../../_components/ui/select";
import { useAuthStore } from "../../../_stores/auth-store";
import { useRoomTypes } from "../../../_hooks/use-room-types";
import { useUpdateRoom, useRooms } from "../../../_hooks/use-rooms";
import { getPartnerLabels, isRestaurant, formatUnitTypeName } from "../../../_lib/utils/partner-labels";
import { RoomStatus, type Room } from "../../../_lib/domain/types";
import { RoomTypeDialog } from "./room-type-dialog";

const editRoomSchema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Raqam kiritilishi shart")
    .max(20, "Raqam 20 ta belgidan oshmasin"),
  floor: z
    .number()
    .int("Tartib raqami butun son bo'lishi kerak")
    .min(1, "Kamida 1 bo'lishi kerak")
    .max(100, "100 dan oshmasligi kerak"),
  roomTypeId: z.string().min(1, "Toifani tanlang"),
  status: z.nativeEnum(RoomStatus),
  isListed: z.boolean(),
  nightlyPrice: z
    .number()
    .min(0, "Narx 0 dan kichik bo'lmasin")
    .optional(),
});

export type EditRoomFormValues = z.infer<typeof editRoomSchema>;

export interface EditRoomDialogProps {
  open: boolean;
  onClose: () => void;
  room: Room | null;
}

export function EditRoomDialog({ open, onClose, room }: EditRoomDialogProps) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);

  const { data: roomTypes = [] } = useRoomTypes();
  const { allRooms = [] } = useRooms();
  const updateRoom = useUpdateRoom();

  const [openEditType, setOpenEditType] = useState(false);

  const form = useForm<EditRoomFormValues>({
    resolver: zodResolver(editRoomSchema),
    defaultValues: {
      number: "",
      floor: 1,
      roomTypeId: "",
      status: RoomStatus.VACANT_CLEAN,
      isListed: true,
      nightlyPrice: undefined,
    },
  });

  useEffect(() => {
    if (open && room) {
      form.reset({
        number: room.number,
        floor: room.floor ?? 1,
        roomTypeId: room.roomTypeId,
        status: room.status,
        isListed: room.isListed,
        nightlyPrice: room.nightlyPrice ?? undefined,
      });
    }
  }, [open, room, form]);

  const currentNumber = useWatch({ control: form.control, name: "number" });
  const selectedRoomTypeId = useWatch({ control: form.control, name: "roomTypeId" });
  const currentStatus = useWatch({ control: form.control, name: "status" }) || RoomStatus.VACANT_CLEAN;

  const selectedRoomType = useMemo(
    () => roomTypes.find((t) => t.id === selectedRoomTypeId),
    [roomTypes, selectedRoomTypeId],
  );

  // Duplicate check against other rooms (excluding this room)
  const isDuplicate = useMemo(() => {
    if (!room || !currentNumber?.trim()) return null;
    const cleanNumber = currentNumber.trim().toLowerCase();
    return (
      allRooms.find(
        (r) => r.id !== room.id && r.number.trim().toLowerCase() === cleanNumber,
      ) ?? null
    );
  }, [room, currentNumber, allRooms]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!room) return;
    if (isDuplicate) {
      toast.error(`${labels.unitSingular} ${isDuplicate.number} allaqachon mavjud.`);
      return;
    }

    try {
      await updateRoom.mutateAsync({
        id: room.id,
        values: {
          number: values.number,
          floor: values.floor,
          roomTypeId: values.roomTypeId,
          status: values.status,
          isListed: values.isListed,
          nightlyPrice: values.nightlyPrice,
        },
      });

      toast.success(`${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} ${values.number} yangilandi`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi");
    }
  });

  const isSubmitting = form.formState.isSubmitting || updateRoom.isPending;

  const roomTypeSelectOptions = [
    { value: "", label: `${labels.unitTypeLabel}ni tanlang` },
    ...roomTypes.map((rt) => ({
      value: rt.id,
      label: `${formatUnitTypeName(rt.name, labels)} — ${rt.basePrice.toLocaleString("ru-RU")} so'm (${rt.capacity} ${labels.capacitySuffix})`,
    })),
  ];

  if (!room) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} ${room.number} ni tahrirlash`}
        description={`${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} raqami, ${labels.floorSingular}i, ${labels.unitTypeLabel.toLowerCase()} va sotuv holatini o'zgartiring.`}
        size="md"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4 group-disabled:opacity-75">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Identifikator / Raqam */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="er-number" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {labels.unitIdentifierLabel}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="er-number"
                  placeholder={labels.unitIdentifierPlaceholder}
                  aria-invalid={Boolean(form.formState.errors.number) || Boolean(isDuplicate)}
                  {...form.register("number")}
                />
                {isDuplicate ? (
                  <p className="text-xs font-medium text-red-500">
                    {labels.unitSingular} {isDuplicate.number} allaqachon mavjud!
                  </p>
                ) : form.formState.errors.number ? (
                  <p className="text-xs text-red-500">{form.formState.errors.number.message}</p>
                ) : null}
              </div>

              {/* Qavat */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="er-floor" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="er-floor"
                  type="number"
                  min={1}
                  max={100}
                  aria-invalid={Boolean(form.formState.errors.floor)}
                  {...form.register("floor", { valueAsNumber: true })}
                />
                {form.formState.errors.floor ? (
                  <p className="text-xs text-red-500">{form.formState.errors.floor.message}</p>
                ) : restaurant ? (
                  <p className="text-[11px] text-zinc-500">1 (Asosiy zal), 2 (VIP kabinetlar), 3 (Terrasa)</p>
                ) : null}
              </div>
            </div>

            {/* XONA TURI (Boshqa turga o'tkazish imkoniyati!) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="er-type" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {labels.unitTypeLabel} <span className="text-red-500">*</span>
                </Label>
                {selectedRoomType && (
                  <button
                    type="button"
                    onClick={() => setOpenEditType(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" /> Ushbu {labels.unitTypeLabel.toLowerCase()} parametrlarini tahrirlash
                  </button>
                )}
              </div>
              <Select
                id="er-type"
                value={selectedRoomTypeId}
                onChange={(e) =>
                  form.setValue("roomTypeId", e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                options={roomTypeSelectOptions}
                error={Boolean(form.formState.errors.roomTypeId)}
              />
              {form.formState.errors.roomTypeId && (
                <p className="text-xs text-red-500">{form.formState.errors.roomTypeId.message}</p>
              )}

              {selectedRoomType && (
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-800">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                    {formatUnitTypeName(selectedRoomType.name, labels)}
                  </span>
                  <span>•</span>
                  <span>{selectedRoomType.capacity} {labels.capacitySuffix}</span>
                  <span>•</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {selectedRoomType.basePrice.toLocaleString("ru-RU")} {labels.pricingUnit}
                  </span>
                </div>
              )}
            </div>

            {/* Holati va Narx */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="er-status" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {labels.unitStatusLabel}
                </Label>
                <Select
                  id="er-status"
                  value={currentStatus}
                  onChange={(e) =>
                    form.setValue("status", e.target.value as RoomStatus, { shouldDirty: true })
                  }
                  options={[
                    { value: RoomStatus.VACANT_CLEAN, label: labels.statusCleanLabel },
                    { value: RoomStatus.VACANT_DIRTY, label: labels.statusDirtyLabel },
                    { value: RoomStatus.OCCUPIED, label: labels.statusOccupiedLabel },
                    { value: RoomStatus.OUT_OF_SERVICE, label: labels.statusOutOfServiceLabel },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="er-price" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {restaurant
                    ? "Minimal depozit override (so'm)"
                    : `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} narxi (so'm override)`}
                </Label>
                <Controller
                  name="nightlyPrice"
                  control={form.control}
                  render={({ field }) => (
                    <MoneyInput
                      id="er-price"
                      placeholder={selectedRoomType?.basePrice ? String(selectedRoomType.basePrice) : "Standart narx"}
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                      }
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
                <p className="text-[11px] text-zinc-500">
                  Standart {labels.unitTypeLabel.toLowerCase()} narxi: {selectedRoomType?.basePrice.toLocaleString("ru-RU") ?? 0} so&apos;m
                </p>
              </div>
            </div>

            {/* E'longa chiqarish */}
            <label className="flex items-center gap-2.5 cursor-pointer rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700"
                {...form.register("isListed")}
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Sotuvda ko&apos;rinadi (e&apos;londa faol)
                </span>
                <span className="text-[11px] text-zinc-500">
                  O&apos;chirilsa {labels.unitSingular.toLowerCase()} mijozlar uchun qidiruv va bron ro&apos;yxatida ko&apos;rinmaydi
                </span>
              </div>
            </label>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 mt-2 dark:border-zinc-800">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Bekor qilish
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || Boolean(isDuplicate)}
                loading={isSubmitting}
              >
                Saqlash
              </Button>
            </div>
          </fieldset>
        </form>
      </Dialog>

      {/* Xona turini tahrirlash dialogi (faqat agar foydalanuvchi tur parametrlarini ham o'zgartirmoqchi bo'lsa) */}
      {selectedRoomType && (
        <RoomTypeDialog
          open={openEditType}
          onClose={() => setOpenEditType(false)}
          editing={selectedRoomType}
        />
      )}
    </>
  );
}
