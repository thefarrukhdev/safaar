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
  Sparkles,
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
import { useRoomTypes, useCreateRoomType } from "../../../_hooks/use-room-types";
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

const DEFAULT_RESTAURANT_TABLE_TYPES = [
  {
    name: "Standart stol (Umumiy zal)",
    description: "Umumiy zalda joylashgan shinam stol (2-4 kishi)",
    basePrice: 0,
    capacity: 4,
    amenities: ["wifi", "ac"],
  },
  {
    name: "Oila uchun stol — Bolalar bilan",
    description: "Katta oilalar va bolalar uchun qulay stol (4-6 kishi)",
    basePrice: 0,
    capacity: 6,
    amenities: ["wifi", "ac", "high_chair"],
  },
  {
    name: "VIP kabinet (Maxsus xona)",
    description: "Alohida eshikli shinam VIP kabinet (6-8 kishi)",
    basePrice: 100000,
    capacity: 8,
    amenities: ["wifi", "ac", "vip"],
  },
  {
    name: "Ochiq terrasa — Beg'ubor havo",
    description: "Tashqaridagi manzarali shinam stol (2-4 kishi)",
    basePrice: 0,
    capacity: 4,
    amenities: ["wifi", "terrace"],
  },
  {
    name: "Katta kompaniya stoli (Tadbirlar)",
    description: "Kompaniya va bayramlar uchun katta stol (8-12 kishi)",
    basePrice: 150000,
    capacity: 12,
    amenities: ["wifi", "ac"],
  },
  {
    name: "Tapchan / So‘ri — Milliy uslub",
    description: "Xontaxtali qulay milliy so'ri (6-8 kishi)",
    basePrice: 50000,
    capacity: 8,
    amenities: ["wifi"],
  },
];

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
  const createRoomType = useCreateRoomType();

  const [openCreateType, setOpenCreateType] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSeedingPresets, setIsSeedingPresets] = useState(false);

  const handleSeedPresets = async () => {
    if (isSeedingPresets) return;
    setIsSeedingPresets(true);
    try {
      let firstCreatedId = "";
      for (const preset of DEFAULT_RESTAURANT_TABLE_TYPES) {
        const created = await createRoomType.mutateAsync(preset);
        if (!firstCreatedId && created?.id) {
          firstCreatedId = created.id;
        }
      }
      toast.success("Standart stol toifalari muvaffaqiyatli yuklandi!");
      if (firstCreatedId) {
        form.setValue("roomTypeId", firstCreatedId, { shouldValidate: true, shouldDirty: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toifalarni yuklashda xatolik yuz berdi");
    } finally {
      setIsSeedingPresets(false);
    }
  };

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
    {
      value: "",
      label:
        roomTypes.length === 0
          ? "Toifalar mavjud emas — yangi qo'shing"
          : `${labels.unitTypeLabel}ni tanlang`,
    },
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
        size="lg"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4 group-disabled:opacity-75">
            {/* Bo'sh turlar holati agar hali toifa bo'lmasa */}
            {roomTypes.length === 0 && !isLoadingTypes && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Hali {labels.unitTypePlural.toLowerCase()} yaratilmagan
                    </h4>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      {restaurant
                        ? "Stol qo'shish uchun avval kamida bitta stol toifasi (masalan, Umumiy zal, VIP kabinet, Terrasa) bo'lishi kerak. Standart toifalarni 1 ta bosishda yuklashingiz yoki o'zingiz yangi toifa yaratishingiz mumkin."
                        : `${labels.unitPlural.charAt(0).toUpperCase() + labels.unitPlural.slice(1)}ni qo'shish uchun avval kamida bitta ${labels.unitTypeLabel.toLowerCase()} yaratilishi kerak.`}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {restaurant && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          loading={isSeedingPresets}
                          onClick={handleSeedPresets}
                          className="gap-1.5 font-semibold"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Standart toifalarni yuklash
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant={restaurant ? "outline" : "primary"}
                        size="sm"
                        onClick={() => setOpenCreateType(true)}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {labels.unitTypeLabel} yaratish
                      </Button>
                    </div>
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
                RESTORAN STOL FORM (PREMIUM MODERN DESIGN & FULLY RESPONSIVE)
            ═══════════════════════════════════════════════════════════════════ */}
            {restaurant ? (
              <div className="flex flex-col gap-4">
                {/* 1. Stol turi & Qaysi zalda joylashganligi */}
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ar-type" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Stol turi <span className="text-red-500">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setOpenCreateType(true)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100/80 dark:bg-brand-950/60 dark:text-brand-400 dark:hover:bg-brand-900/50 transition-colors cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Yangi toifa
                      </button>
                    </div>
                    <Select
                      id="ar-type"
                      placeholder={roomTypes.length === 0 ? "Avval toifa yarating yoki yuklang" : "Stol toifasini tanlang"}
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
                      Joylashgan zali <span className="text-red-500">*</span>
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
                <div className="grid gap-3.5 sm:grid-cols-2">
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ar-capacity" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Stol sig&apos;imi <span className="text-red-500">*</span>
                      </Label>
                      <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                        {currentCapacity} kishilik
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="grid grid-cols-5 gap-1 flex-1">
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
                              "h-9 rounded-lg text-xs font-bold transition-all border cursor-pointer flex items-center justify-center",
                              currentCapacity === cap
                                ? "bg-brand-600 text-white border-brand-600 shadow-2xs"
                                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-700",
                            )}
                          >
                            {cap}
                          </button>
                        ))}
                      </div>
                      <div className="relative w-16 shrink-0">
                        <Input
                          id="ar-capacity"
                          type="number"
                          min={1}
                          max={100}
                          placeholder="Boshqa"
                          title="Boshqa sig'im kiritish"
                          className="h-9 px-1 text-center text-xs font-bold"
                          value={currentCapacity}
                          onChange={(e) =>
                            form.setValue("capacity", Math.max(1, Number(e.target.value) || 1), {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Stol qulayliklari (Multi-select Grid) */}
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                    {RESTAURANT_TABLE_AMENITY_OPTIONS.map((item) => {
                      const isSelected = currentAmenities.includes(item.value);
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => toggleAmenity(item.value)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-all cursor-pointer border text-left",
                            isSelected
                              ? "bg-brand-50/90 text-brand-900 border-brand-400 font-semibold shadow-2xs dark:bg-brand-950/60 dark:text-brand-200 dark:border-brand-600 ring-1 ring-brand-400/40"
                              : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-850 dark:text-zinc-300 dark:border-zinc-700/80 dark:hover:bg-zinc-800",
                          )}
                        >
                          <span className="text-sm shrink-0">{item.icon}</span>
                          <span className="truncate flex-1 text-[11px] font-medium">{item.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Stol rasmi va E'lon statusi (Yonma-yon 2 ustun) */}
                <div className="grid gap-3.5 sm:grid-cols-2 items-start">
                  {/* Stol rasmi */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Stol rasmi
                      </Label>
                      <span className="text-[11px] text-zinc-400">Ixtiyoriy</span>
                    </div>

                    {currentImageUrl ? (
                      <div className="relative group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900/10 dark:border-zinc-800 h-24 w-full flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentImageUrl}
                          alt="Stol rasmi"
                          className="h-full w-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-zinc-900 hover:bg-white shadow-sm transition-colors">
                            <Camera className="h-3 w-3" />
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
                            className="inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600 shadow-sm transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                            O&apos;chirish
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        className={cn(
                          "relative flex items-center justify-between gap-3 rounded-xl border border-dashed p-3 h-24 cursor-pointer transition-all",
                          isUploadingImage
                            ? "border-brand-400 bg-brand-50/30 dark:border-brand-700 dark:bg-brand-950/20"
                            : "border-zinc-300 hover:border-brand-500 bg-zinc-50/60 hover:bg-brand-50/15 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-brand-500",
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
                          <div className="flex items-center gap-2 py-1 mx-auto">
                            <Loader2 className="h-5 w-5 animate-spin text-brand-600 dark:text-brand-400" />
                            <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                              Rasm yuklanmoqda...
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/80 dark:text-brand-400">
                                <Upload className="h-4 w-4" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                  Rasm yuklash
                                </span>
                                <span className="text-[11px] text-zinc-500 truncate">
                                  PNG, JPG (5MB)
                                </span>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-2xs border border-zinc-200 hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700">
                              Tanlash
                            </span>
                          </>
                        )}
                      </label>
                    )}
                  </div>

                  {/* E'longa chiqarish */}
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Sotuv va ko&apos;rinish
                    </Label>
                    <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 hover:bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/40 p-3 h-24 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 shrink-0"
                        {...form.register("isListed")}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Darhol e&apos;longa chiqarilsin
                        </span>
                        <span className="text-[11px] text-zinc-500 leading-tight mt-0.5">
                          Mijozlar ushbu stolni to&apos;g&apos;ridan-to&apos;g&apos;ri band qilishlari mumkin bo&apos;ladi
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
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

      {/* Xona / Stol turi yaratish dialogi (on-the-fly) */}
      <RoomTypeDialog
        open={openCreateType}
        onClose={() => setOpenCreateType(false)}
        onSuccess={(newType) => {
          form.setValue("roomTypeId", newType.id, { shouldValidate: true, shouldDirty: true });
          if (restaurant && newType.capacity) {
            form.setValue("capacity", newType.capacity, { shouldValidate: true, shouldDirty: true });
          }
        }}
      />
    </>
  );
}
