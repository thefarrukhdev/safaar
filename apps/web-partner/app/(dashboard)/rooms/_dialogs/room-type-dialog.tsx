"use client";

import {
  ImageIcon,
  UploadCloud,
  X,
  DoorOpen,
  BedDouble,
  Bath,
  Eye,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { useCreateRoomType, useUpdateRoomType } from "../../../_hooks/use-room-types";
import { useCreateRoom, useBulkCreateRooms, useRooms } from "../../../_hooks/use-rooms";
import { partners } from "../../../_lib/api";
import { cn } from "../../../_lib/utils/cn";
import { getPartnerLabels, isRestaurant } from "../../../_lib/utils/partner-labels";
import { RoomStatus, type RoomType } from "../../../_lib/domain/types";

export const SAFAAR_HOTEL_ROOM_TYPES = [
  { value: "Standard", label: "Standard — standart xona" },
  { value: "Superior", label: "Superior — yaxshilangan standart xona" },
  { value: "Deluxe", label: "Deluxe — yuqori qulaylikdagi xona" },
  { value: "Lux", label: "Lux — premium xona" },
  { value: "Junior Suite", label: "Junior Suite — kichik suite" },
  { value: "Suite", label: "Suite — alohida yotoq va mehmonxona" },
  { value: "Family Room", label: "Family Room — oilaviy xona" },
  { value: "Apartment", label: "Apartment — oshxona/yashash maydoniga ega xona" },
];

export const BED_TYPE_OPTIONS = [
  { value: "", label: "Tanlang (ixtiyoriy)", short: "", defaultCap: 2 },
  { value: "Single Bed", label: "Single Bed — 1 kishilik karavot", short: "Single", defaultCap: 1 },
  { value: "Twin Beds", label: "Twin Beds — 2 ta alohida karavot", short: "Twin", defaultCap: 2 },
  { value: "Double Bed", label: "Double Bed — katta 2 kishilik karavot", short: "Double", defaultCap: 2 },
  { value: "Queen Bed", label: "Queen Bed — keng karavot", short: "Queen", defaultCap: 2 },
  { value: "King Bed", label: "King Bed — eng katta karavot", short: "King", defaultCap: 2 },
  { value: "Bunk Bed", label: "Bunk Bed — 2 qavatli karavot", short: "Bunk", defaultCap: 2 },
];

export const BATHROOM_OPTIONS = [
  { value: "", label: "Tanlang (ixtiyoriy)" },
  { value: "Shower", label: "Shower — Dush" },
  { value: "Bath", label: "Bath — Vanna" },
  { value: "Both", label: "Both — Dush va vanna" },
];

export const VIEW_OPTIONS = [
  { value: "", label: "Tanlang (ixtiyoriy)" },
  { value: "City", label: "City View — Shahar ko'rinishi" },
  { value: "Mountain", label: "Mountain View — Tog' ko'rinishi" },
  { value: "Garden", label: "Garden View — Bog' ko'rinishi" },
  { value: "Sea", label: "Sea/Lake View — Suv/Ko'l ko'rinishi" },
  { value: "Courtyard", label: "Courtyard View — Ichki hovli ko'rinishi" },
];

export const ROOM_AMENITY_OPTIONS = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "tv", label: "Televizor" },
  { value: "ac", label: "Konditsioner" },
  { value: "minibar", label: "Mini-bar" },
  { value: "balcony", label: "Balkon" },
  { value: "kitchen", label: "Oshxona" },
  { value: "parking", label: "Avtoturargoh" },
  { value: "breakfast", label: "Nonushta" },
  { value: "pool", label: "Hovuz" },
  { value: "spa", label: "Spa" },
  { value: "gym", label: "Sport zal" },
  { value: "safe", label: "Seyf" },
  { value: "hairdryer", label: "Fen" },
  { value: "workspace", label: "Ish stoli" },
];

export const TABLE_AMENITY_OPTIONS = [
  { value: "window", label: "Deraza yonida" },
  { value: "terrace", label: "Terrasa/tashqarida" },
  { value: "vip", label: "VIP kabinet" },
  { value: "quiet", label: "Tinch burchak" },
  { value: "near_stage", label: "Sahna yonida" },
  { value: "high_chair", label: "Bolalar kursisi" },
  { value: "wheelchair", label: "Aravachaga mos" },
  { value: "smoking", label: "Chekish zonasi" },
];

function computeCombinationName(category: string, bedType: string): string {
  if (!category) return "";
  const bed = BED_TYPE_OPTIONS.find((b) => b.value === bedType);
  if (!bed || !bed.short) return category;
  if (category === "Family Room") return `Family ${bed.short}`;
  if (category === "Apartment") return `Apartment ${bed.short}`;
  return `${category} ${bed.short}`;
}

const roomTypeSchema = z.object({
  category: z.string().optional(),
  name: z.string().trim().min(2, "Nom kamida 2 ta belgidan iborat bo'lishi kerak"),
  description: z.string().max(500, "Tavsif ko'pi bilan 500 belgi bo'lishi mumkin").optional(),
  imageUrl: z.string().optional(),
  bedType: z.string().optional(),
  bathroom: z.string().optional(),
  viewType: z.string().optional(),
  sizeSqm: z
    .number()
    .min(0, "Maydon manfiy bo'lishi mumkin emas")
    .max(1000, "Maydon 1000 m² dan oshmasligi kerak")
    .optional(),
  basePrice: z
    .number()
    .min(0, "Narx 0 dan kichik bo'lmasin"),
  capacity: z
    .number()
    .int("Sig'im butun son bo'lishi kerak")
    .min(1, "Kamida 1 kishilik bo'lishi kerak")
    .max(50, "Ko'pi bilan 50 kishilik bo'lishi mumkin"),
  amenities: z.array(z.string()),
});

export type RoomTypeFormValues = z.infer<typeof roomTypeSchema>;

export interface RoomTypeDialogProps {
  open: boolean;
  onClose: () => void;
  editing?: RoomType | null;
  onSuccess?: (savedRoomType: RoomType) => void;
}

export function RoomTypeDialog(props: RoomTypeDialogProps) {
  if (!props.open) return null;
  return <RoomTypeDialogForm {...props} />;
}

function RoomTypeDialogForm({
  open,
  onClose,
  editing,
  onSuccess,
}: RoomTypeDialogProps) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();

  const { allRooms = [] } = useRooms();
  const createRoom = useCreateRoom();
  const bulkCreateRooms = useBulkCreateRooms();

  const restaurant = isRestaurant(partnerType);
  const labels = getPartnerLabels(partnerType);
  const amenityOptions = restaurant ? TABLE_AMENITY_OPTIONS : ROOM_AMENITY_OPTIONS;

  const [uploadingImage, setUploadingImage] = useState(false);
  const [autoCreateRoom, setAutoCreateRoom] = useState(true);
  const [autoRoomCount, setAutoRoomCount] = useState(1);
  const [customRoomNumber, setCustomRoomNumber] = useState<string | null>(null);
  const [customRoomFloor, setCustomRoomFloor] = useState<number | null>(null);

  const suggestedNextRoom = useMemo(() => {
    if (allRooms.length === 0) return { number: "101", floor: 1 };
    const nums = allRooms
      .map((r) => parseInt(r.number.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n) && n > 0);
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 101;
    const floor = nextNum >= 100 ? Math.floor(nextNum / 100) : 1;
    return {
      number: String(nextNum),
      floor: floor > 0 && floor <= 100 ? floor : 1,
    };
  }, [allRooms]);

  const autoRoomNumber = customRoomNumber ?? suggestedNextRoom.number;
  const autoRoomFloor = customRoomFloor ?? suggestedNextRoom.floor;

  const initialCategory = editing
    ? SAFAAR_HOTEL_ROOM_TYPES.find((cat) =>
        editing.name.toLowerCase().startsWith(cat.value.toLowerCase()),
      )?.value || "Standard"
    : "Standard";

  const initialBed = editing
    ? editing.bedType || ""
    : restaurant
      ? ""
      : "Double Bed";

  const initialName = editing
    ? editing.name
    : restaurant
      ? ""
      : computeCombinationName(initialCategory, initialBed);

  const form = useForm<RoomTypeFormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      category: initialCategory,
      name: initialName,
      description: editing?.description ?? "",
      imageUrl: editing?.imageUrl ?? "",
      bedType: initialBed,
      bathroom: "",
      viewType: "",
      sizeSqm: editing?.sizeSqm ?? undefined,
      basePrice: editing?.basePrice ?? (restaurant ? 0 : 350000),
      capacity: editing?.capacity ?? 2,
      amenities: (editing?.amenities as string[]) ?? [],
    },
  });

  const selectedAmenities = useWatch({ control: form.control, name: "amenities" }) ?? [];
  const imageUrl = useWatch({ control: form.control, name: "imageUrl" }) ?? "";
  const bedTypeValue = useWatch({ control: form.control, name: "bedType" }) ?? "";
  const categoryValue = useWatch({ control: form.control, name: "category" }) ?? "Standard";
  const nameValue = useWatch({ control: form.control, name: "name" }) ?? "";

  const handleCategoryChange = (newCategory: string) => {
    form.setValue("category", newCategory, { shouldDirty: true });
    if (!editing && !restaurant) {
      const combo = computeCombinationName(newCategory, bedTypeValue);
      form.setValue("name", combo, { shouldValidate: true, shouldDirty: true });
      if (newCategory === "Family Room" || newCategory === "Apartment") {
        form.setValue("capacity", 4, { shouldValidate: true });
      }
    }
  };

  const handleBedTypeChange = (newBedType: string) => {
    form.setValue("bedType", newBedType, { shouldValidate: true, shouldDirty: true });
    if (!editing && !restaurant) {
      const combo = computeCombinationName(categoryValue, newBedType);
      form.setValue("name", combo, { shouldValidate: true, shouldDirty: true });
      const bedObj = BED_TYPE_OPTIONS.find((b) => b.value === newBedType);
      if (bedObj?.defaultCap) {
        form.setValue("capacity", bedObj.defaultCap, { shouldValidate: true });
      }
    }
  };

  const toggleAmenity = (value: string) => {
    const current = form.getValues("amenities") || [];
    if (current.includes(value)) {
      form.setValue(
        "amenities",
        current.filter((a) => a !== value),
        { shouldDirty: true },
      );
    } else {
      form.setValue("amenities", [...current, value], { shouldDirty: true });
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const uploaded = await partners.uploadImage(file, accessToken);
      form.setValue("imageUrl", uploaded.url, { shouldDirty: true, shouldValidate: true });
      toast.success("Rasm muvaffaqiyatli yuklandi");
    } catch {
      toast.error("Rasmni yuklab bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAutoRoomNumberChange = (val: string) => {
    setCustomRoomNumber(val);
    const cleanDigits = val.replace(/\D/g, "");
    if (cleanDigits.length >= 3) {
      const derivedFloor = parseInt(cleanDigits.slice(0, cleanDigits.length - 2), 10);
      if (derivedFloor > 0 && derivedFloor <= 100) {
        setCustomRoomFloor(derivedFloor);
      }
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const finalAmenities = [...values.amenities];
      if (values.bathroom) {
        finalAmenities.push(`bath_${values.bathroom.toLowerCase()}`);
      }
      if (values.viewType) {
        finalAmenities.push(`view_${values.viewType.toLowerCase()}`);
      }

      // Tavsifni boyitish
      let finalDescription = values.description?.trim() || "";
      const extraDetails: string[] = [];
      if (values.bathroom) {
        const bathLabel = BATHROOM_OPTIONS.find((b) => b.value === values.bathroom)?.label;
        if (bathLabel) extraDetails.push(`Vanna: ${bathLabel.split("—")[1]?.trim() || bathLabel}`);
      }
      if (values.viewType) {
        const viewLabel = VIEW_OPTIONS.find((v) => v.value === values.viewType)?.label;
        if (viewLabel) extraDetails.push(`Ko'rinish: ${viewLabel.split("—")[1]?.trim() || viewLabel}`);
      }
      if (extraDetails.length > 0 && !finalDescription.includes("Vanna:") && !finalDescription.includes("Ko'rinish:")) {
        finalDescription = finalDescription
          ? `${finalDescription} (${extraDetails.join(", ")})`
          : extraDetails.join(". ");
      }

      if (editing) {
        const updated = await updateRoomType.mutateAsync({
          id: editing.id,
          values: {
            name: values.name,
            description: finalDescription,
            imageUrl: values.imageUrl,
            bedType: values.bedType,
            sizeSqm: values.sizeSqm,
            basePrice: restaurant ? 0 : values.basePrice,
            capacity: values.capacity,
            amenities: finalAmenities,
          },
        });
        toast.success(`"${values.name}" ma'lumotlari yangilandi`);
        onSuccess?.(updated);
        onClose();
        return;
      }

      // Yangi toifa yaratish
      const created = await createRoomType.mutateAsync({
        name: values.name,
        description: finalDescription,
        imageUrl: values.imageUrl,
        bedType: values.bedType,
        sizeSqm: values.sizeSqm,
        basePrice: restaurant ? 0 : values.basePrice,
        capacity: values.capacity,
        amenities: finalAmenities,
      });

      // MEHMONXONA UCHUN AVTOMATIK XONALAR BO'LIMIGA XONA QO'SHISH
      if (!restaurant && autoCreateRoom && created?.id) {
        try {
          const count = Math.max(1, Math.min(Number(autoRoomCount) || 1, 50));
          const cleanNum = autoRoomNumber.trim();
          const parsedStart = parseInt(cleanNum.replace(/\D/g, ""), 10) || 101;
          const prefix = cleanNum.replace(/\d+/g, "").trim();

          if (count === 1) {
            await createRoom.mutateAsync({
              number: cleanNum || String(parsedStart),
              floor: autoRoomFloor || 1,
              roomTypeId: created.id,
              status: RoomStatus.VACANT_CLEAN,
              isListed: true,
              nightlyPrice: values.basePrice,
              capacity: values.capacity,
              amenities: finalAmenities,
              imageUrl: values.imageUrl,
            });
            toast.success(
              `"${values.name}" varianti yaratildi va Xonalar bo'limiga xona (${cleanNum || parsedStart}) qo'shildi!`,
            );
          } else {
            await bulkCreateRooms.mutateAsync({
              roomTypeId: created.id,
              prefix,
              startNumber: parsedStart,
              count,
              floor: autoRoomFloor || 1,
              basePrice: values.basePrice,
              capacity: values.capacity,
              amenities: finalAmenities,
            });
            toast.success(
              `"${values.name}" varianti yaratildi va Xonalar bo'limiga ${count} ta xona qo'shildi!`,
            );
          }
        } catch (roomErr) {
          console.error("Avtomatik xona qo'shishda xatolik:", roomErr);
          toast.warning(
            `"${values.name}" varianti yaratildi, lekin xona qo'shishda xatolik bo'ldi. Uni Xonalar bo'limida qo'lda qo'shishingiz mumkin.`,
          );
        }
      } else {
        toast.success(`Yangi ${labels.unitTypeLabel.toLowerCase()} "${values.name}" qo'shildi`);
      }

      onSuccess?.(created);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi");
    }
  });

  const err = form.formState.errors;
  const isSubmitting = form.formState.isSubmitting || updateRoomType.isPending || createRoomType.isPending;
  const isLoading = isSubmitting || uploadingImage;

  const title = editing
    ? `${labels.unitTypeLabel}ni tahrirlash`
    : `Yangi ${labels.unitTypeLabel.toLowerCase()} yaratish`;

  const description = editing
    ? `Ushbu ${labels.unitTypeLabel.toLowerCase()} parametri, narxi va qulayliklarini yangilang.`
    : `Mehmonlar bron qilishi uchun ${labels.unitTypeLabel.toLowerCase()} andozasi va narxini kiriting.`;

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset disabled={isLoading} className="flex flex-col gap-4 group-disabled:opacity-75">
          {/* 1. XONA TURI VA KARAVOT TURI (Faqat Mehmonxona uchun yangi Safaar tuzilmasi) */}
          {!restaurant ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-category" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <DoorOpen className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  Xona turi <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="rt-category"
                  value={categoryValue}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  options={SAFAAR_HOTEL_ROOM_TYPES}
                />
                <p className="text-[11px] text-zinc-500">
                  Safaar rasmiy standart toifasi
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-bed" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <BedDouble className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  Karavot turi <span className="text-red-500">*</span>
                </Label>
                <Select
                  id="rt-bed"
                  value={bedTypeValue}
                  onChange={(e) => handleBedTypeChange(e.target.value)}
                  options={BED_TYPE_OPTIONS.filter((b) => b.value !== "")}
                />
                <p className="text-[11px] text-zinc-500">
                  Alohida karavot konfiguratsiyasi
                </p>
              </div>
            </div>
          ) : null}

          {/* 2. E'LON / TOIFA NOMI */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-name" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>{labels.unitTypeLabel} nomi <span className="text-red-500">*</span></span>
              {!restaurant && nameValue && (
                <span className="text-[11px] font-normal text-brand-600 dark:text-brand-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Kombinatsiya: {nameValue}
                </span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="rt-name"
                placeholder={
                  restaurant
                    ? "Masalan: Umumiy zal, VIP Kabinet, Terrasa..."
                    : "Masalan: Standard Twin, Deluxe Double, Lux King..."
                }
                aria-invalid={Boolean(err.name)}
                list={restaurant ? "room-type-presets" : undefined}
                {...form.register("name")}
              />
              {restaurant && (
                <datalist id="room-type-presets">
                  <option value="Umumiy zal (Standard)" />
                  <option value="VIP Kabinet" />
                  <option value="Terrasa" />
                  <option value="Banket stoli" />
                  <option value="Bar stoli" />
                </datalist>
              )}
            </div>
            {err.name ? (
              <p className="text-xs text-red-500">{err.name.message}</p>
            ) : !restaurant ? (
              <p className="text-[11px] text-zinc-500">
                Turistlar e&apos;londa ko&apos;radigan nom (kerak bo&apos;lsa qo&apos;shimcha aniqlik kiritishingiz mumkin)
              </p>
            ) : null}
          </div>

          {/* 3. NARX VA SIG'IM (2 ustun) */}
          <div className={restaurant ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
            {!restaurant && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-price" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {`${labels.priceLabel} narx (so'm)`} <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="basePrice"
                  control={form.control}
                  render={({ field }) => (
                    <MoneyInput
                      id="rt-price"
                      placeholder="350 000"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      aria-invalid={Boolean(err.basePrice)}
                    />
                  )}
                />
                {err.basePrice ? (
                  <p className="text-xs text-red-500">{err.basePrice.message}</p>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    {`Ushbu turdagi ${labels.unitPlural.toLowerCase()} uchun standart ${labels.pricingUnit} narx`}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rt-capacity" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Maksimal sig&apos;im ({labels.capacitySuffix}) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="rt-capacity"
                type="number"
                min={1}
                max={50}
                placeholder="2"
                aria-invalid={Boolean(err.capacity)}
                {...form.register("capacity", { valueAsNumber: true })}
              />
              {err.capacity ? (
                <p className="text-xs text-red-500">{err.capacity.message}</p>
              ) : (
                <p className="text-[11px] text-zinc-500">
                  {restaurant
                    ? "Stol atrofida o'tirishi mumkin bo'lgan maksimal mehmonlar soni"
                    : `${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)}da sig'ishi mumkin bo'lgan maksimal ${labels.guestLabel.toLowerCase()}lar soni`}
                </p>
              )}
            </div>
          </div>

          {/* 4. MAYDON, VANNA VA KO'RINISH (Faqat mehmonxona uchun) */}
          {!restaurant && !labels.isBus && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-size" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Xona maydoni (m²)
                </Label>
                <Input
                  id="rt-size"
                  type="number"
                  min={0}
                  max={1000}
                  placeholder="28"
                  aria-invalid={Boolean(err.sizeSqm)}
                  {...form.register("sizeSqm", {
                    setValueAs: (v) => (v === "" || v === undefined ? undefined : Number(v)),
                  })}
                />
                {err.sizeSqm && <p className="text-xs text-red-500">{err.sizeSqm.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-bathroom" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5 text-zinc-500" />
                  Vanna turi
                </Label>
                <Controller
                  name="bathroom"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      id="rt-bathroom"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={BATHROOM_OPTIONS}
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-view" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-zinc-500" />
                  Ko&apos;rinish (Manzara)
                </Label>
                <Controller
                  name="viewType"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      id="rt-view"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      options={VIEW_OPTIONS}
                    />
                  )}
                />
              </div>
            </div>
          )}

          {/* 5. QULAYLIKLAR VA JİHOZLAR */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Qulayliklar va jihozlar
              </Label>
              <span className="text-[11px] text-zinc-500">
                {selectedAmenities.length > 0 ? `${selectedAmenities.length} ta tanlandi` : "Ixtiyoriy"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
              {amenityOptions.map((a) => {
                const checked = selectedAmenities.includes(a.value);
                return (
                  <Button
                    key={a.value}
                    type="button"
                    variant={checked ? "subtle" : "outline"}
                    size="sm"
                    onClick={() => toggleAmenity(a.value)}
                    aria-pressed={checked}
                    className={cn(
                      "rounded-full h-7 px-3 text-xs font-medium transition-all duration-150 cursor-pointer",
                      checked
                        ? "border-brand-500 bg-brand-50 text-brand-700 shadow-2xs dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-500/80"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
                    )}
                  >
                    {a.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 6. MEHMONXONA UCHUN: XONALAR BO'LIMIGA AVTOMATIK XONA QO'SHISH (Faqat yangi variant yaratilayotganda) */}
          {!restaurant && !editing && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 dark:border-brand-900/50 dark:bg-brand-950/20 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-2xs">
                    <DoorOpen className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      Xonalar bo&apos;limiga avtomatik qo&apos;shish
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Ushbu variant uchun &ldquo;Xonalar&rdquo; bo&apos;limida darhol xona yaratiladi
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCreateRoom}
                    onChange={(e) => setAutoCreateRoom(e.target.checked)}
                    className="size-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Faol
                  </span>
                </label>
              </div>

              {autoCreateRoom && (
                <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-brand-100 dark:border-brand-900/30">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="auto-count" className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      Xonalar soni
                    </Label>
                    <Input
                      id="auto-count"
                      type="number"
                      min={1}
                      max={50}
                      value={autoRoomCount}
                      onChange={(e) => setAutoRoomCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="bg-white dark:bg-zinc-900 h-8 text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="auto-number" className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      {autoRoomCount > 1 ? "Boshlang'ich raqam" : "Xona raqami"}
                    </Label>
                    <Input
                      id="auto-number"
                      value={autoRoomNumber}
                      onChange={(e) => handleAutoRoomNumberChange(e.target.value)}
                      placeholder="101"
                      className="bg-white dark:bg-zinc-900 h-8 text-xs font-medium"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="auto-floor" className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      Qavat
                    </Label>
                    <Input
                      id="auto-floor"
                      type="number"
                      min={1}
                      max={100}
                      value={autoRoomFloor}
                      onChange={(e) => setCustomRoomFloor(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="bg-white dark:bg-zinc-900 h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. RASM YUKLASH */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} fotosurati (ixtiyoriy)
            </Label>
            <div className="flex items-center gap-3">
              <label className="group relative h-20 w-28 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition-all hover:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900/50 shrink-0">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={`${labels.unitSingular} rasmi`}
                    className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-85"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-zinc-400">
                    <ImageIcon className="h-5 w-5 text-zinc-400 transition-colors group-hover:text-brand-500" aria-hidden />
                    <span className="text-[10px] font-medium">Rasm yuklash</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImageUpload(file);
                  }}
                />
              </label>

              <div className="flex flex-col justify-center gap-1.5 flex-1">
                <span className="text-[11px] text-zinc-500 leading-snug">
                  {restaurant
                    ? "Stol yoki zonaning fotosurati mijozlar e'tiborini tortish va bron qilish qaroriga to'g'ridan-to'g'ri ta'sir qiladi."
                    : "Fotosurat mijozlar e'tiborini tortish va bron qilish qaroriga to'g'ridan-to'g'ri ta'sir qiladi."}
                </span>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue("imageUrl", "", { shouldDirty: true })}
                    className="h-7 w-fit text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Rasmni olib tashlash
                  </Button>
                )}
                {uploadingImage && (
                  <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 animate-pulse flex items-center gap-1">
                    <UploadCloud className="h-3.5 w-3.5 animate-bounce" /> Rasm yuklanmoqda...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pastki tugmalar */}
          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 mt-1 dark:border-zinc-800">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading} loading={isLoading}>
              {editing ? "Saqlash" : `${labels.unitTypeLabel}ni yaratish`}
            </Button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
