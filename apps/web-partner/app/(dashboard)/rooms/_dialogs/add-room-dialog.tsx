"use client";

import {
  AlertCircle,
  Check,
  DoorOpen,
  Layers,
  Plus,
} from "lucide-react";
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
import { useCreateRoom, useBulkCreateRooms, useRooms } from "../../../_hooks/use-rooms";
import { useGenerateBeds } from "../../../_hooks/use-beds";
import { cn } from "../../../_lib/utils/cn";
import { getPartnerLabels, hasBeds, isRestaurant } from "../../../_lib/utils/partner-labels";
import { RoomStatus } from "../../../_lib/domain/types";
import { RoomTypeDialog } from "./room-type-dialog";

const addRoomSchema = z
  .object({
    mode: z.enum(["single", "bulk"]),
    roomTypeId: z.string().min(1, "Xona turini tanlang"),
    number: z.string().optional(),
    startNumber: z.number().optional(),
    count: z.number().optional(),
    floor: z
      .number()
      .int("Qavat butun son bo'lishi kerak")
      .min(1, "Qavat kamida 1 bo'lishi kerak")
      .max(100, "Qavat 100 dan oshmasligi kerak"),
    status: z.nativeEnum(RoomStatus),
    isListed: z.boolean(),
    nightlyPrice: z.number().min(0, "Narx 0 dan kichik bo'lmasin").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "single") {
      if (!data.number || data.number.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Xona raqami kiritilishi shart",
          path: ["number"],
        });
      } else if (data.number.trim().length > 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Xona raqami 20 ta belgidan oshmasin",
          path: ["number"],
        });
      }
    } else if (data.mode === "bulk") {
      if (data.startNumber === undefined || data.startNumber < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Boshlanish raqamini kiriting",
          path: ["startNumber"],
        });
      }
      if (data.count === undefined || data.count < 1 || data.count > 200) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Xonalar soni 1 dan 200 gacha bo'lishi kerak",
          path: ["count"],
        });
      }
    }
  });

export type AddRoomFormValues = z.infer<typeof addRoomSchema>;

export interface AddRoomDialogProps {
  open: boolean;
  onClose: () => void;
  defaultFloor?: number;
  defaultRoomTypeId?: string;
}

export function AddRoomDialog({
  open,
  onClose,
  defaultFloor = 1,
  defaultRoomTypeId,
}: AddRoomDialogProps) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const isHostel = hasBeds(partnerType);
  const restaurant = isRestaurant(partnerType);
  const labels = getPartnerLabels(partnerType);

  const { data: roomTypes = [], isLoading: isLoadingTypes } = useRoomTypes();
  const { allRooms = [] } = useRooms();
  const createRoom = useCreateRoom();
  const bulkCreateRooms = useBulkCreateRooms();
  const generateBeds = useGenerateBeds();

  const [openCreateType, setOpenCreateType] = useState(false);

  const form = useForm<AddRoomFormValues>({
    resolver: zodResolver(addRoomSchema),
    defaultValues: {
      mode: "single",
      roomTypeId: defaultRoomTypeId ?? "",
      number: "",
      startNumber: defaultFloor * 100 + 1,
      count: 10,
      floor: defaultFloor,
      status: RoomStatus.VACANT_CLEAN,
      isListed: true,
      nightlyPrice: undefined,
    },
  });

  const creationMode = useWatch({ control: form.control, name: "mode" });

  const handleModeChange = (newMode: "single" | "bulk") => {
    form.setValue("mode", newMode, { shouldValidate: false });
    const currentFloor = form.getValues("floor") || 1;
    if (newMode === "bulk" && !form.getValues("startNumber")) {
      form.setValue("startNumber", currentFloor * 100 + 1);
      form.setValue("count", 10);
    }
  };

  useEffect(() => {
    if (open) {
      const initialTypeId = defaultRoomTypeId || (roomTypes.length > 0 ? roomTypes[0].id : "");
      form.reset({
        mode: "single",
        roomTypeId: initialTypeId,
        number: "",
        startNumber: defaultFloor * 100 + 1,
        count: 10,
        floor: defaultFloor,
        status: RoomStatus.VACANT_CLEAN,
        isListed: true,
        nightlyPrice: undefined,
      });
    }
  }, [open, defaultFloor, defaultRoomTypeId, roomTypes, form]);

  const selectedRoomTypeId = useWatch({ control: form.control, name: "roomTypeId" });
  const singleNumber = useWatch({ control: form.control, name: "number" });
  const bulkStartNumber = useWatch({ control: form.control, name: "startNumber" });
  const bulkCount = useWatch({ control: form.control, name: "count" });
  const currentStatus = useWatch({ control: form.control, name: "status" }) || RoomStatus.VACANT_CLEAN;

  const selectedRoomType = useMemo(
    () => roomTypes.find((t) => t.id === selectedRoomTypeId),
    [roomTypes, selectedRoomTypeId],
  );

  // Single room duplicate check
  const singleDuplicate = useMemo(() => {
    if (creationMode !== "single" || !singleNumber?.trim()) return null;
    const cleanNumber = singleNumber.trim().toLowerCase();
    return allRooms.find((r) => r.number.trim().toLowerCase() === cleanNumber) ?? null;
  }, [creationMode, singleNumber, allRooms]);

  // Bulk rooms generation preview & conflicts check
  const bulkPreview = useMemo(() => {
    if (creationMode !== "bulk" || !bulkStartNumber || !bulkCount) return [];
    const count = Math.min(Math.max(1, bulkCount), 50); // limit preview items to 50
    const list: Array<{ number: string; exists: boolean }> = [];
    const existingSet = new Set(allRooms.map((r) => r.number.trim().toLowerCase()));

    for (let i = 0; i < count; i++) {
      const numStr = String(bulkStartNumber + i);
      list.push({
        number: numStr,
        exists: existingSet.has(numStr.toLowerCase()),
      });
    }
    return list;
  }, [creationMode, bulkStartNumber, bulkCount, allRooms]);

  // Auto-suggest floor when typing room number (e.g. 201 -> floor 2, 1204 -> floor 12)
  const handleNumberChange = (val: string) => {
    form.setValue("number", val, { shouldValidate: true, shouldDirty: true });
    const cleanDigits = val.replace(/\D/g, "");
    if (cleanDigits.length >= 3) {
      const derivedFloor = parseInt(cleanDigits.slice(0, cleanDigits.length - 2), 10);
      if (derivedFloor > 0 && derivedFloor <= 100) {
        form.setValue("floor", derivedFloor, { shouldValidate: true });
      }
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (values.mode === "single") {
        if (!values.number?.trim()) {
          toast.error("Xona raqami kiritilishi shart");
          return;
        }
        if (singleDuplicate) {
          toast.error(`${labels.unitSingular} ${singleDuplicate.number} allaqachon mavjud.`);
          return;
        }

        const created = await createRoom.mutateAsync({
          number: values.number.trim(),
          floor: values.floor,
          roomTypeId: values.roomTypeId,
          status: values.status,
          isListed: values.isListed,
          nightlyPrice: values.nightlyPrice,
        });

        if (isHostel && selectedRoomType?.capacity) {
          await generateBeds.mutateAsync({
            roomId: created.id,
            count: selectedRoomType.capacity,
          });
        }

        toast.success(
          `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} ${values.number} muvaffaqiyatli qo'shildi!`,
        );
        onClose();
        return;
      }

      if (values.mode === "bulk") {
        if (!values.startNumber || !values.count) {
          toast.error("Boshlang'ich raqam va xonalar sonini kiriting");
          return;
        }

        const res = await bulkCreateRooms.mutateAsync({
          startNumber: values.startNumber,
          count: values.count,
          floor: values.floor,
          roomTypeId: values.roomTypeId,
          basePrice: values.nightlyPrice,
          capacity: selectedRoomType?.capacity,
        });

        toast.success(
          `${res.added ?? values.count} ta ${labels.unitSingular} muvaffaqiyatli yaratildi!`,
        );
        onClose();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi");
    }
  });

  const isSubmitting =
    form.formState.isSubmitting ||
    createRoom.isPending ||
    bulkCreateRooms.isPending ||
    generateBeds.isPending;

  const roomTypeSelectOptions = [
    { value: "", label: "Xona turini tanlang" },
    ...roomTypes.map((rt) => ({
      value: rt.id,
      label: `${rt.name} — ${rt.basePrice.toLocaleString("ru-RU")} so'm (${rt.capacity} kishi)`,
    })),
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={`Yangi ${labels.unitSingular} qo'shish`}
        description={`Mehmonxonaga yangi ${labels.unitSingular} yoki bir nechta xonalarni birdaniga qo'shing.`}
        size="md"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4 group-disabled:opacity-75">
            {/* Bo'sh xona turlari holati (Agar hali hech qanday RoomType bo'lmasa) */}
            {roomTypes.length === 0 && !isLoadingTypes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Hali xona turlari yaratilmagan
                    </h4>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Xonalarni raqamlab qo&apos;shish uchun avval kamida bitta xona turi (masalan: Standart, Lyuks) yaratilishi kerak.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setOpenCreateType(true)}
                      className="mt-3 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Xona turi yaratish
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Yakka vs Ommaviy Rejim Tanlagich */}
            <div className="flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/80">
              <button
                type="button"
                onClick={() => handleModeChange("single")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer",
                  creationMode === "single"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
                )}
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Yakka xona
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("bulk")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 cursor-pointer",
                  creationMode === "bulk"
                    ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Guruhlab qo&apos;shish (Ommaviy)
              </button>
            </div>

            {/* XONA TURI TANLASH */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ar-type" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Xona turi <span className="text-red-500">*</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setOpenCreateType(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Yangi tur yaratish
                </button>
              </div>
              <Select
                id="ar-type"
                placeholder="Xona turini tanlang"
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
                    {selectedRoomType.name}
                  </span>
                  <span>•</span>
                  <span>{selectedRoomType.capacity} kishilik</span>
                  <span>•</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {selectedRoomType.basePrice.toLocaleString("ru-RU")} so&apos;m / kecha
                  </span>
                </div>
              )}
            </div>

            {/* ─── YAKKA XONA REJIMI ─── */}
            {creationMode === "single" && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Xona raqami */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-number" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} raqami{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ar-number"
                      placeholder={restaurant ? "Stol-12, VIP-1" : "101, 204..."}
                      value={singleNumber || ""}
                      onChange={(e) => handleNumberChange(e.target.value)}
                      aria-invalid={Boolean(form.formState.errors.number) || Boolean(singleDuplicate)}
                    />
                    {singleDuplicate ? (
                      <p className="text-xs font-medium text-red-500">
                        {labels.unitSingular} {singleDuplicate.number} allaqachon mavjud!
                      </p>
                    ) : form.formState.errors.number ? (
                      <p className="text-xs text-red-500">{form.formState.errors.number.message}</p>
                    ) : (
                      <p className="text-[11px] text-zinc-500">Masalan: 101, 102 yoki 2A</p>
                    )}
                  </div>

                  {/* Qavat */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-floor" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ar-floor"
                      type="number"
                      min={1}
                      max={100}
                      aria-invalid={Boolean(form.formState.errors.floor)}
                      {...form.register("floor", { valueAsNumber: true })}
                    />
                    {form.formState.errors.floor && (
                      <p className="text-xs text-red-500">{form.formState.errors.floor.message}</p>
                    )}
                  </div>
                </div>

                {/* Boshlang'ich holat */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-status" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Boshlang&apos;ich holat
                    </Label>
                    <Select
                      id="ar-status"
                      value={currentStatus}
                      onChange={(e) =>
                        form.setValue("status", e.target.value as RoomStatus, {
                          shouldDirty: true,
                        })
                      }
                      options={[
                        { value: RoomStatus.VACANT_CLEAN, label: "Toza (Vacant Clean)" },
                        { value: RoomStatus.VACANT_DIRTY, label: "Nopok (Tozalash kerak)" },
                        { value: RoomStatus.OUT_OF_SERVICE, label: "Ta'mirda (Out of Service)" },
                      ]}
                    />
                  </div>

                  {/* Alohida narx override (ixtiyoriy) */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-price" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Maxsus narx (ixtiyoriy)
                    </Label>
                    <Controller
                      name="nightlyPrice"
                      control={form.control}
                      render={({ field }) => (
                        <MoneyInput
                          id="ar-price"
                          placeholder={selectedRoomType?.basePrice ? String(selectedRoomType.basePrice) : "Standart narx"}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                          }
                          onBlur={field.onBlur}
                          ref={field.ref}
                          aria-invalid={Boolean(form.formState.errors.nightlyPrice)}
                        />
                      )}
                    />
                    <p className="text-[11px] text-zinc-500">
                      Kiritilmasa, xona turining narxi olinadi
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
                      Darhol e&apos;longa chiqarilsin (sotuvda ko&apos;rinadi)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Mehmonlar ushbu xonani to&apos;g&apos;ridan-to&apos;g&apos;ri platformadan bron qilishi mumkin bo&apos;ladi
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* ─── GURUHLAB (OMMAVIY) QO'SHISH REJIMI ─── */}
            {creationMode === "bulk" && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-start" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Boshlanish raqami <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ar-start"
                      type="number"
                      min={1}
                      placeholder="101"
                      aria-invalid={Boolean(form.formState.errors.startNumber)}
                      {...form.register("startNumber", { valueAsNumber: true })}
                    />
                    {form.formState.errors.startNumber && (
                      <p className="text-xs text-red-500">{form.formState.errors.startNumber.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-count" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Xonalar soni <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ar-count"
                      type="number"
                      min={1}
                      max={200}
                      placeholder="10"
                      aria-invalid={Boolean(form.formState.errors.count)}
                      {...form.register("count", { valueAsNumber: true })}
                    />
                    {form.formState.errors.count && (
                      <p className="text-xs text-red-500">{form.formState.errors.count.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-bulk-floor" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="ar-bulk-floor"
                      type="number"
                      min={1}
                      max={100}
                      aria-invalid={Boolean(form.formState.errors.floor)}
                      {...form.register("floor", { valueAsNumber: true })}
                    />
                    {form.formState.errors.floor && (
                      <p className="text-xs text-red-500">{form.formState.errors.floor.message}</p>
                    )}
                  </div>
                </div>

                {/* Yaratiladigan xonalar jonli ko'rinishi */}
                {bulkPreview.length > 0 && (
                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Yaratiladigan xonalar ({bulkCount ?? 0} ta):
                      </span>
                      {bulkPreview.some((p) => p.exists) && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          Mavjudlari avtomatik o&apos;tkazib yuboriladi
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {bulkPreview.map((item) => (
                        <span
                          key={item.number}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                            item.exists
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 line-through opacity-70"
                              : "bg-white text-zinc-900 shadow-2xs border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
                          )}
                        >
                          {!item.exists && <Check className="h-3 w-3 text-emerald-500" />}
                          {item.number}
                        </span>
                      ))}
                      {(bulkCount ?? 0) > bulkPreview.length && (
                        <span className="text-xs text-zinc-400 self-center">
                          va yana {(bulkCount ?? 0) - bulkPreview.length} ta...
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 mt-2 dark:border-zinc-800">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Bekor qilish
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || (creationMode === "single" && Boolean(singleDuplicate))}
                loading={isSubmitting}
                className="gap-1.5 font-semibold"
              >
                <Plus className="h-4 w-4" />
                {creationMode === "bulk"
                  ? `${bulkCount ?? 0} ta xona yaratish`
                  : `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} qo'shish`}
              </Button>
            </div>
          </fieldset>
        </form>
      </Dialog>

      {/* Xona turi yaratish dialogi (on-the-fly) */}
      <RoomTypeDialog
        open={openCreateType}
        onClose={() => setOpenCreateType(false)}
        onSuccess={(newType) => {
          form.setValue("roomTypeId", newType.id, { shouldValidate: true, shouldDirty: true });
        }}
      />
    </>
  );
}
