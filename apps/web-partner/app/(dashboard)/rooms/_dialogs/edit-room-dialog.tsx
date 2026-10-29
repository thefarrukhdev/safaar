"use client";

import {
  Camera,
  Check,
  Edit3,
  Loader2,
  Trash2,
  Upload,
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
import { useUpdateRoom, useRooms } from "../../../_hooks/use-rooms";
import { partners } from "../../../_lib/api";
import { cn } from "../../../_lib/utils/cn";
import {
  getPartnerLabels,
  isRestaurant,
  formatUnitTypeName,
  RESTAURANT_HALL_OPTIONS,
  RESTAURANT_TABLE_AMENITY_OPTIONS,
} from "../../../_lib/utils/partner-labels";
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
  capacity: z.number().int().min(1, "Kamida 1 kishilik bo'lishi kerak").max(50, "Ko'pi bilan 50").optional(),
  amenities: z.array(z.string()),
  imageUrl: z.string().optional(),
  fileId: z.string().optional(),
});

export type EditRoomFormValues = z.infer<typeof editRoomSchema>;

export interface EditRoomDialogProps {
  open: boolean;
  onClose: () => void;
  room: Room | null;
}

export function EditRoomDialog({ open, onClose, room }: EditRoomDialogProps) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);

  const { data: roomTypes = [] } = useRoomTypes();
  const { allRooms = [] } = useRooms();
  const updateRoom = useUpdateRoom();

  const [openEditType, setOpenEditType] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const form = useForm<EditRoomFormValues>({
    resolver: zodResolver(editRoomSchema),
    defaultValues: {
      number: "",
      floor: 1,
      roomTypeId: "",
      status: RoomStatus.VACANT_CLEAN,
      isListed: true,
      nightlyPrice: undefined,
      capacity: 4,
      amenities: [],
      imageUrl: "",
      fileId: "",
    },
  });

  useEffect(() => {
    if (open && room) {
      const matchedType = roomTypes.find((t) => t.id === room.roomTypeId);
      form.reset({
        number: room.number,
        floor: room.floor ?? 1,
        roomTypeId: room.roomTypeId,
        status: room.status,
        isListed: room.isListed,
        nightlyPrice: room.nightlyPrice ?? undefined,
        capacity: room.capacity ?? matchedType?.capacity ?? 4,
        amenities: room.amenities ?? [],
        imageUrl: room.photos?.[0]?.url ?? "",
        fileId: room.photos?.[0]?.id ?? "",
      });
    }
  }, [open, room, roomTypes, form]);

  const currentNumber = useWatch({ control: form.control, name: "number" });
  const selectedRoomTypeId = useWatch({ control: form.control, name: "roomTypeId" });
  const currentStatus = useWatch({ control: form.control, name: "status" }) || RoomStatus.VACANT_CLEAN;
  const currentFloor = useWatch({ control: form.control, name: "floor" }) || 1;
  const currentCapacity = useWatch({ control: form.control, name: "capacity" }) ?? 4;
  const currentAmenities = useWatch({ control: form.control, name: "amenities" }) || [];
  const currentImageUrl = useWatch({ control: form.control, name: "imageUrl" });

  const selectedRoomType = useMemo(
    () => roomTypes.find((t) => t.id === selectedRoomTypeId),
    [roomTypes, selectedRoomTypeId],
  );

  const handleRoomTypeChange = (newTypeId: string) => {
    form.setValue("roomTypeId", newTypeId, { shouldValidate: true, shouldDirty: true });
    const rt = roomTypes.find((t) => t.id === newTypeId);
    if (restaurant && rt?.capacity && !form.getValues("capacity")) {
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
          nightlyPrice: restaurant ? 0 : values.nightlyPrice,
          capacity: values.capacity,

          amenities: values.amenities,
          fileId: values.fileId,
          imageUrl: values.imageUrl,
        },
      });

      toast.success(
        `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} ${values.number} yangilandi`,
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi");
    }
  });

  const isSubmitting = form.formState.isSubmitting || updateRoom.isPending || isUploadingImage;

  const roomTypeSelectOptions = [
    { value: "", label: `${labels.unitTypeLabel}ni tanlang` },
    ...roomTypes.map((rt) => ({
      value: rt.id,
      label: `${formatUnitTypeName(rt.name, labels)} — ${rt.basePrice > 0 ? `${rt.basePrice.toLocaleString("ru-RU")} so'm` : "Bepul"} (${rt.capacity} ${labels.capacitySuffix})`,
    })),
  ];

  if (!room) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={
          restaurant
            ? `Stol ${room.number} ni tahrirlash`
            : `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} ${room.number} ni tahrirlash`
        }
        description={
          restaurant
            ? "Stol turi, sig'imi, qulayliklari, zali va rasmini o'zgartiring."
            : `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} raqami, ${labels.floorSingular}i, ${labels.unitTypeLabel.toLowerCase()} va sotuv holatini o'zgartiring.`
        }
        size="lg"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset disabled={isSubmitting} className="flex flex-col gap-4 group-disabled:opacity-75">
            {restaurant ? (
              /* ═══════════════════════════════════════════════════════════════════
                 RESTORAN STOL TAHRIRLASH (PREMIUM MODERN DESIGN & RESPONSIVE)
              ═══════════════════════════════════════════════════════════════════ */
              <div className="flex flex-col gap-4">
                {/* 1. Stol turi & Qaysi zalda joylashganligi */}
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="er-type" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Stol turi <span className="text-red-500">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={() => setOpenEditType(true)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100/80 dark:bg-brand-950/60 dark:text-brand-400 dark:hover:bg-brand-900/50 transition-colors cursor-pointer"
                      >
                        <Edit3 className="h-3 w-3" /> Toifani tahrirlash
                      </button>
                    </div>
                    <Select
                      id="er-type"
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
                    <Label htmlFor="er-hall" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Joylashgan zali <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      id="er-hall"
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
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="er-number" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Stol raqami yoki nomi <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="er-number"
                      placeholder="Masalan: 12, VIP-1 yoki T-2"
                      aria-invalid={Boolean(form.formState.errors.number) || Boolean(isDuplicate)}
                      {...form.register("number")}
                    />
                    {isDuplicate ? (
                      <p className="text-xs font-medium text-red-500">
                        Stol {isDuplicate.number} allaqachon mavjud!
                      </p>
                    ) : form.formState.errors.number ? (
                      <p className="text-xs text-red-500">{form.formState.errors.number.message}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="er-capacity" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
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
                          id="er-capacity"
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

                {/* 4. Stol rasmi va Holati / Sotuvda faolligi (Yonma-yon 2 ustun) */}
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
                      <div className="relative group overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900/10 dark:border-zinc-800 h-28 w-full flex items-center justify-center">
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
                          "relative flex items-center justify-between gap-3 rounded-xl border border-dashed p-3 h-28 cursor-pointer transition-all",
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

                  {/* Holati va Sotuvda faolligi */}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="er-status" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        Stol holati
                      </Label>
                      <Select
                        id="er-status"
                        value={currentStatus}
                        onChange={(e) =>
                          form.setValue("status", e.target.value as RoomStatus, { shouldDirty: true })
                        }
                        options={[
                          { value: RoomStatus.VACANT_CLEAN, label: "Bo'sh (Buyurtmaga tayyor)" },
                          { value: RoomStatus.OCCUPIED, label: "Band (Mehmonlar o'tiribdi)" },
                          { value: RoomStatus.OUT_OF_SERVICE, label: "Vaqtincha xizmatda emas" },
                        ]}
                      />
                    </div>

                    <label className="flex items-start gap-2.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 hover:bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/40 p-2.5 cursor-pointer transition-colors mt-0.5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 shrink-0"
                        {...form.register("isListed")}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          Sotuvda ko&apos;rinadi
                        </span>
                        <span className="text-[10px] text-zinc-500 leading-tight">
                          Platformada bron qilish uchun ochiq
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              /* ═══════════════════════════════════════════════════════════════════
                 MEHMONXONA / HOSTEL / DACHA UCHUN STANDART FORMA
              ═══════════════════════════════════════════════════════════════════ */
              <>
                <div className="grid gap-3 sm:grid-cols-2">
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
                    {form.formState.errors.floor && (
                      <p className="text-xs text-red-500">{form.formState.errors.floor.message}</p>
                    )}
                  </div>
                </div>

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
                      {!restaurant && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {selectedRoomType.basePrice.toLocaleString("ru-RU")} {labels.pricingUnit}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className={restaurant ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
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

                  {!restaurant && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="er-price" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} narxi (so&apos;m override)
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
                        Standart narx: {selectedRoomType?.basePrice.toLocaleString("ru-RU") ?? 0} so&apos;m
                      </p>
                    </div>
                  )}
                </div>


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
              </>
            )}

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

      {/* Xona / Stol turini tahrirlash dialogi */}
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
