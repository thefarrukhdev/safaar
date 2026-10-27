"use client";

import {
  AlertCircle,
  BedSingle,
  Camera,
  CarFront,
  Check,
  DoorOpen,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UtensilsCrossed,
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
import { partners } from "../../../_lib/api";
import { cn } from "../../../_lib/utils/cn";
import {
  getPartnerLabels,
  hasBeds,
  hasBuses,
  isRestaurant,
  formatUnitTypeName,
  RESTAURANT_HALL_OPTIONS,
  RESTAURANT_TABLE_AMENITY_OPTIONS,
} from "../../../_lib/utils/partner-labels";
import { RoomStatus } from "../../../_lib/domain/types";
import { RoomTypeDialog } from "./room-type-dialog";

const addRoomSchema = z
  .object({
    mode: z.enum(["single", "bulk"]),
    roomTypeId: z.string().min(1, "Toifani tanlang"),
    number: z.string().optional(),
    prefix: z.string().optional(),
    startNumber: z.number().optional(),
    count: z.number().optional(),
    floor: z
      .number()
      .int("Tartib raqami butun son bo'lishi kerak")
      .min(1, "Kamida 1 bo'lishi kerak")
      .max(100, "100 dan oshmasligi kerak"),
    status: z.nativeEnum(RoomStatus),
    isListed: z.boolean(),
    nightlyPrice: z.number().min(0, "Narx 0 dan kichik bo'lmasin").optional(),
    capacity: z.number().int().min(1, "Kamida 1 kishilik bo'lishi kerak").max(50, "Ko'pi bilan 50").optional(),
    amenities: z.array(z.string()),
    imageUrl: z.string().optional(),
    fileId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "single") {
      if (!data.number || data.number.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Raqam kiritilishi shart",
          path: ["number"],
        });
      } else if (data.number.trim().length > 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Raqam 20 ta belgidan oshmasin",
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
          message: "Birliklar soni 1 dan 200 gacha bo'lishi kerak",
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
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const isHostel = hasBeds(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);
  const labels = getPartnerLabels(partnerType);

  const SingleIcon = isBus ? CarFront : restaurant ? UtensilsCrossed : isHostel ? BedSingle : DoorOpen;

  const { data: roomTypes = [], isLoading: isLoadingTypes } = useRoomTypes();
  const { allRooms = [] } = useRooms();
  const createRoom = useCreateRoom();
  const bulkCreateRooms = useBulkCreateRooms();
  const generateBeds = useGenerateBeds();

  const [openCreateType, setOpenCreateType] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const form = useForm<AddRoomFormValues>({
    resolver: zodResolver(addRoomSchema),
    defaultValues: {
      mode: "single",
      roomTypeId: defaultRoomTypeId ?? "",
      number: "",
      prefix: "",
      startNumber: restaurant || isBus ? 1 : defaultFloor * 100 + 1,
      count: 10,
      floor: defaultFloor,
      status: RoomStatus.VACANT_CLEAN,
      isListed: true,
      nightlyPrice: undefined,
      capacity: 4,
      amenities: [],
      imageUrl: "",
      fileId: "",
    },
  });

  const creationMode = useWatch({ control: form.control, name: "mode" });

  const handleModeChange = (newMode: "single" | "bulk") => {
    form.setValue("mode", newMode, { shouldValidate: false });
    const currentFloor = form.getValues("floor") || 1;
    if (newMode === "bulk" && !form.getValues("startNumber")) {
      form.setValue("startNumber", restaurant || isBus ? 1 : currentFloor * 100 + 1);
      form.setValue("count", 10);
    }
  };

  useEffect(() => {
    if (open) {
      const initialTypeId = defaultRoomTypeId || (roomTypes.length > 0 ? roomTypes[0].id : "");
      const matchedType = roomTypes.find((t) => t.id === initialTypeId);
      form.reset({
        mode: "single",
        roomTypeId: initialTypeId,
        number: "",
        prefix: "",
        startNumber: restaurant || isBus ? 1 : defaultFloor * 100 + 1,
        count: 10,
        floor: defaultFloor,
        status: RoomStatus.VACANT_CLEAN,
        isListed: true,
        nightlyPrice: undefined,
        capacity: matchedType?.capacity ?? 4,
        amenities: [],
        imageUrl: "",
        fileId: "",
      });
    }
  }, [open, defaultFloor, defaultRoomTypeId, roomTypes, form, restaurant, isBus]);

  // Agar roomTypeId bo'sh bo'lsa va toifalar yuklansa, avtomatik birinchisini tanlash
  useEffect(() => {
    if (open && !form.getValues("roomTypeId") && roomTypes.length > 0) {
      const firstId = defaultRoomTypeId || roomTypes[0].id;
      const matched = roomTypes.find((t) => t.id === firstId);
      form.setValue("roomTypeId", firstId, {
        shouldValidate: true,
      });
      if (restaurant && matched?.capacity) {
        form.setValue("capacity", matched.capacity);
      }
    }
  }, [open, roomTypes, defaultRoomTypeId, form, restaurant]);

  const selectedRoomTypeId = useWatch({ control: form.control, name: "roomTypeId" });
  const singleNumber = useWatch({ control: form.control, name: "number" });
  const bulkPrefix = useWatch({ control: form.control, name: "prefix" }) || "";
  const bulkStartNumber = useWatch({ control: form.control, name: "startNumber" });
  const bulkCount = useWatch({ control: form.control, name: "count" });
  const currentStatus = useWatch({ control: form.control, name: "status" }) || RoomStatus.VACANT_CLEAN;
  const currentAmenities = useWatch({ control: form.control, name: "amenities" }) || [];
  const currentImageUrl = useWatch({ control: form.control, name: "imageUrl" });
  const currentCapacity = useWatch({ control: form.control, name: "capacity" }) ?? 4;
  const currentFloor = useWatch({ control: form.control, name: "floor" }) || 1;

  const selectedRoomType = useMemo(
    () => roomTypes.find((t) => t.id === selectedRoomTypeId),
    [roomTypes, selectedRoomTypeId],
  );

  const handleRoomTypeChange = (newTypeId: string) => {
    form.setValue("roomTypeId", newTypeId, { shouldValidate: true, shouldDirty: true });
    const rt = roomTypes.find((t) => t.id === newTypeId);
    if (restaurant && rt?.capacity) {
      form.setValue("capacity", rt.capacity, { shouldValidate: true, shouldDirty: true });
    }
  };

  const toggleAmenity = (code: string) => {
    const next = currentAmenities.includes(code)
      ? currentAmenities.filter((c) => c !== code)
      : [...currentAmenities, code];
    form.setValue("amenities", next, { shouldDirty: true });
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Faqat rasm faylini tanlashingiz mumkin (JPEG, PNG, WEBP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Rasm hajmi 5MB dan oshmasligi kerak");
      return;
    }
    try {
      setIsUploadingImage(true);
      const res = await partners.uploadImage(file, accessToken);
      form.setValue("imageUrl", res.url, { shouldDirty: true });
      form.setValue("fileId", res.id, { shouldDirty: true });
      toast.success("Stol rasmi yuklandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rasm yuklashda xatolik yuz berdi");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Single room duplicate check
  const singleDuplicate = useMemo(() => {
    if (creationMode !== "single" || !singleNumber?.trim()) return null;
    const cleanNumber = singleNumber.trim().toLowerCase();
    return allRooms.find((r) => r.number.trim().toLowerCase() === cleanNumber) ?? null;
  }, [creationMode, singleNumber, allRooms]);

  // Bulk rooms generation preview & conflicts check
  const bulkPreview = useMemo(() => {
    if (creationMode !== "bulk" || !bulkStartNumber || !bulkCount) return [];
    const count = Math.min(Math.max(1, bulkCount), 50);
    const list: Array<{ number: string; exists: boolean }> = [];
    const existingSet = new Set(allRooms.map((r) => r.number.trim().toLowerCase()));
    const p = bulkPrefix.trim();

    for (let i = 0; i < count; i++) {
      const numStr = p ? `${p}${bulkStartNumber + i}` : String(bulkStartNumber + i);
      list.push({
        number: numStr,
        exists: existingSet.has(numStr.toLowerCase()),
      });
    }
    return list;
  }, [creationMode, bulkStartNumber, bulkCount, bulkPrefix, allRooms]);

  // Auto-suggest floor when typing room number (only for hotels, not restaurants or transport)
  const handleNumberChange = (val: string) => {
    form.setValue("number", val, { shouldValidate: true, shouldDirty: true });
    if (!restaurant && !isBus) {
      const cleanDigits = val.replace(/\D/g, "");
      if (cleanDigits.length >= 3) {
        const derivedFloor = parseInt(cleanDigits.slice(0, cleanDigits.length - 2), 10);
        if (derivedFloor > 0 && derivedFloor <= 100) {
          form.setValue("floor", derivedFloor, { shouldValidate: true });
        }
      }
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (values.mode === "single") {
        if (!values.number?.trim()) {
          toast.error(`${labels.unitIdentifierLabel} kiritilishi shart`);
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
          capacity: values.capacity,
          amenities: values.amenities,
          fileId: values.fileId,
          imageUrl: values.imageUrl,
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
          toast.error(`Boshlang'ich raqam va ${labels.unitPlural.toLowerCase()} sonini kiriting`);
          return;
        }

        const res = await bulkCreateRooms.mutateAsync({
          startNumber: values.startNumber,
          count: values.count,
          floor: values.floor,
          roomTypeId: values.roomTypeId,
          basePrice: values.nightlyPrice,
          capacity: values.capacity ?? selectedRoomType?.capacity,
          prefix: values.prefix?.trim() || undefined,
          amenities: values.amenities,
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
    generateBeds.isPending ||
    isUploadingImage;

  const roomTypeSelectOptions = [
    { value: "", label: `${labels.unitTypeLabel}ni tanlang` },
    ...roomTypes.map((rt) => ({
      value: rt.id,
      label: `${formatUnitTypeName(rt.name, labels)} — ${rt.basePrice > 0 ? `${rt.basePrice.toLocaleString("ru-RU")} so'm` : "Bepul"} (${rt.capacity} ${labels.capacitySuffix})`,
    })),
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={restaurant ? "Yangi stol qo'shish" : `Yangi ${labels.unitSingular} qo'shish`}
        description={
          restaurant
            ? "Restoraningiz uchun stol turi, sig'imi, joylashgan zali, qulayliklari va rasmini kiriting."
            : `${labels.facilityDirectional} yangi ${labels.unitSingular} yoki bir nechta ${labels.unitPlural}ni birdaniga qo'shing.`
        }
        size="md"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4 group-disabled:opacity-75">
            {/* Bo'sh turlar holati (Faqat mehmonxona/hostel uchun agar hali toifa bo'lmasa) */}
            {!restaurant && roomTypes.length === 0 && !isLoadingTypes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Hali {labels.unitTypePlural.toLowerCase()} yaratilmagan
                    </h4>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      {labels.unitPlural.charAt(0).toUpperCase() + labels.unitPlural.slice(1)}ni qo&apos;shish uchun avval kamida bitta {labels.unitTypeLabel.toLowerCase()} yaratilishi kerak.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setOpenCreateType(true)}
                      className="mt-3 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {labels.unitTypeLabel} yaratish
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
                <SingleIcon className="h-3.5 w-3.5" />
                {labels.singleUnitModeLabel}
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
                {labels.bulkUnitModeLabel}
              </button>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                RESTORAN STOL FORM (FOYDALANUVCHI TALABIGA TO'LIQ MOS)
            ═══════════════════════════════════════════════════════════════════ */}
            {restaurant ? (
              <div className="flex flex-col gap-3.5">
                {/* 1. Stol turi & Qaysi zalda joylashganligi */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-type" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Stol turi <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      id="ar-type"
                      placeholder="Stol turini tanlang"
                      value={selectedRoomTypeId}
                      onChange={(e) => handleRoomTypeChange(e.target.value)}
                      options={roomTypeSelectOptions}
                      error={Boolean(form.formState.errors.roomTypeId)}
                    />
                    {form.formState.errors.roomTypeId && (
                      <p className="text-xs text-red-500">{form.formState.errors.roomTypeId.message}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-hall" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Qaysi zalda joylashgan? <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      id="ar-hall"
                      value={String(currentFloor)}
                      onChange={(e) =>
                        form.setValue("floor", Number(e.target.value) || 1, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      options={RESTAURANT_HALL_OPTIONS.map((h) => ({
                        value: String(h.value),
                        label: h.label,
                      }))}
                    />
                  </div>
                </div>

                {/* 2. Stol raqami va Necha kishilik (Sig'imi) */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {creationMode === "single" ? (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ar-number" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Stol raqami yoki nomi <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="ar-number"
                        placeholder="Masalan: 12, VIP-1 yoki T-2"
                        value={singleNumber || ""}
                        onChange={(e) => handleNumberChange(e.target.value)}
                        aria-invalid={Boolean(form.formState.errors.number) || Boolean(singleDuplicate)}
                      />
                      {singleDuplicate ? (
                        <p className="text-xs font-medium text-red-500">
                          Stol {singleDuplicate.number} allaqachon mavjud!
                        </p>
                      ) : form.formState.errors.number ? (
                        <p className="text-xs text-red-500">{form.formState.errors.number.message}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Boshlanish raqami & Soni <span className="text-red-500">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          id="ar-start"
                          type="number"
                          min={1}
                          placeholder="1"
                          {...form.register("startNumber", { valueAsNumber: true })}
                        />
                        <Input
                          id="ar-count"
                          type="number"
                          min={1}
                          max={200}
                          placeholder="10 ta"
                          {...form.register("count", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ar-capacity" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                      <span>Necha kishilik? (Sig&apos;imi) <span className="text-red-500">*</span></span>
                      <span className="text-[11px] font-normal text-zinc-500">
                        {currentCapacity} kishilik
                      </span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        id="ar-capacity"
                        type="number"
                        min={1}
                        max={50}
                        className="w-20 text-center font-bold"
                        value={currentCapacity}
                        onChange={(e) =>
                          form.setValue("capacity", Number(e.target.value) || 1, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                      />
                      <div className="flex flex-wrap gap-1">
                        {[2, 4, 6, 8, 12].map((cap) => (
                          <button
                            key={cap}
                            type="button"
                            onClick={() =>
                              form.setValue("capacity", cap, {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }
                            className={cn(
                              "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer border",
                              currentCapacity === cap
                                ? "bg-brand-600 text-white border-brand-600 shadow-2xs"
                                : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
                            )}
                          >
                            {cap}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Stol qulayliklari (Multi-select Interactive Badges) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Stol qulayliklari
                    </Label>
                    <span className="text-[11px] text-zinc-500">
                      {currentAmenities.length > 0
                        ? `${currentAmenities.length} ta tanlandi`
                        : "Ixtiyoriy"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/40">
                    {RESTAURANT_TABLE_AMENITY_OPTIONS.map((item) => {
                      const isSelected = currentAmenities.includes(item.value);
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => toggleAmenity(item.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer border",
                            isSelected
                              ? "bg-brand-50 text-brand-700 border-brand-300 font-semibold shadow-2xs dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-700"
                              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-100/70 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
                          )}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                          {isSelected && <Check className="h-3 w-3 text-brand-600 dark:text-brand-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Stol rasmi (Drag & Drop / Upload) */}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                    <span>Stol rasmi</span>
                    {currentImageUrl && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Rasm biriktirildi
                      </span>
                    )}
                  </Label>

                  {currentImageUrl ? (
                    <div className="relative group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900/10 dark:border-zinc-800 h-36 w-full flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentImageUrl}
                        alt="Stol rasmi"
                        className="h-full w-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-white shadow-sm transition-colors">
                          <Camera className="h-3.5 w-3.5" />
                          Almashtirish
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleImageFile(f);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            form.setValue("imageUrl", undefined, { shouldDirty: true });
                            form.setValue("fileId", undefined, { shouldDirty: true });
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 shadow-sm transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          O&apos;chirish
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all",
                        isUploadingImage
                          ? "border-brand-400 bg-brand-50/30 dark:border-brand-700 dark:bg-brand-950/20"
                          : "border-zinc-200 bg-zinc-50/60 hover:border-zinc-300 hover:bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700",
                      )}
                    >
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={isUploadingImage}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleImageFile(f);
                        }}
                      />
                      {isUploadingImage ? (
                        <div className="flex flex-col items-center gap-1.5 py-2">
                          <Loader2 className="h-6 w-6 animate-spin text-brand-600 dark:text-brand-400" />
                          <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                            Rasm yuklanmoqda...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 py-1">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-400">
                            <Upload className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            Stol rasmini yuklash
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            PNG, JPG, WEBP (5MB gacha)
                          </span>
                        </div>
                      )}
                    </label>
                  )}
                </div>

                {/* 5. E'longa chiqarish */}
                <label className="flex items-center gap-2.5 cursor-pointer rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700"
                    {...form.register("isListed")}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Darhol e&apos;longa chiqarilsin (bron uchun ko&apos;rinadi)
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Mijozlar ushbu stolni platformadan to&apos;g&apos;ridan-to&apos;g&apos;ri band qilishi mumkin bo&apos;ladi
                    </span>
                  </div>
                </label>
              </div>
            ) : (
              /* ═══════════════════════════════════════════════════════════════════
                 MEHMONXONA / HOSTEL / DACHA / TRANSPORT UCHUN STANDART FORMA
              ═══════════════════════════════════════════════════════════════════ */
              <>
                {/* TOIFA TANLASH */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ar-type" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {labels.unitTypeLabel} <span className="text-red-500">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setOpenCreateType(true)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Yangi {labels.unitTypeLabel.toLowerCase()} yaratish
                    </button>
                  </div>
                  <Select
                    id="ar-type"
                    placeholder={`${labels.unitTypeLabel}ni tanlang`}
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

                {/* YAKKA XONA REJIMI */}
                {creationMode === "single" && (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ar-number" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {labels.unitIdentifierLabel}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="ar-number"
                          placeholder={labels.unitIdentifierPlaceholder}
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
                          <p className="text-[11px] text-zinc-500">
                            Masalan: {labels.unitIdentifierPlaceholder}
                          </p>
                        )}
                      </div>

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
                            { value: RoomStatus.VACANT_CLEAN, label: labels.statusCleanLabel },
                            { value: RoomStatus.VACANT_DIRTY, label: labels.statusDirtyLabel },
                            { value: RoomStatus.OUT_OF_SERVICE, label: labels.statusOutOfServiceLabel },
                          ]}
                        />
                      </div>

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
                          Kiritilmasa, {labels.unitTypeLabel.toLowerCase()} narxi olinadi
                        </p>
                      </div>
                    </div>

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
                          {labels.guestLabel}lar ushbu {labels.unitSingular.toLowerCase()}ni to&apos;g&apos;ridan-to&apos;g&apos;ri platformadan bron qilishi mumkin bo&apos;ladi
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* GURUHLAB (OMMAVIY) QO'SHISH REJIMI */}
                {creationMode === "bulk" && (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ar-prefix" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Prefiks (ixtiyoriy)
                        </Label>
                        <Input
                          id="ar-prefix"
                          placeholder={isBus ? "Avto-" : "Masalan: B-"}
                          {...form.register("prefix")}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ar-start" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Boshlanish raqami <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="ar-start"
                          type="number"
                          min={1}
                          placeholder={isBus ? "1" : "101"}
                          aria-invalid={Boolean(form.formState.errors.startNumber)}
                          {...form.register("startNumber", { valueAsNumber: true })}
                        />
                        {form.formState.errors.startNumber && (
                          <p className="text-xs text-red-500">{form.formState.errors.startNumber.message}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ar-count" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {labels.unitPlural.charAt(0).toUpperCase() + labels.unitPlural.slice(1)} soni <span className="text-red-500">*</span>
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

                    {bulkPreview.length > 0 && (
                      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            Yaratiladigan {labels.unitPlural.toLowerCase()} ({bulkCount ?? 0} ta):
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
              </>
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
                  ? `${bulkCount ?? 0} ta ${labels.unitSingular.toLowerCase()} yaratish`
                  : `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} qo'shish`}
              </Button>
            </div>
          </fieldset>
        </form>
      </Dialog>

      {/* Xona turi yaratish dialogi (on-the-fly, faqat mehmonxona/hostel uchun) */}
      {!restaurant && (
        <RoomTypeDialog
          open={openCreateType}
          onClose={() => setOpenCreateType(false)}
          onSuccess={(newType) => {
            form.setValue("roomTypeId", newType.id, { shouldValidate: true, shouldDirty: true });
          }}
        />
      )}
    </>
  );
}
