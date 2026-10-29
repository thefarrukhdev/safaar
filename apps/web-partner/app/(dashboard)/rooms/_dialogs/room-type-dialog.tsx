"use client";

import {
  ImageIcon,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { partners } from "../../../_lib/api";
import { cn } from "../../../_lib/utils/cn";
import { getPartnerLabels, isRestaurant } from "../../../_lib/utils/partner-labels";
import { type RoomType } from "../../../_lib/domain/types";

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

export const BED_TYPE_OPTIONS = [
  { value: "", label: "Tanlang (ixtiyoriy)" },
  { value: "Single Bed", label: "Single Bed — 1 kishilik karavot" },
  { value: "Twin Beds", label: "Twin Beds — 2 ta alohida karavot" },
  { value: "Double Bed", label: "Double Bed — katta 2 kishilik karavot" },
  { value: "Queen Bed", label: "Queen Bed — keng karavot" },
  { value: "King Bed", label: "King Bed — eng katta karavot" },
  { value: "Bunk Bed", label: "Bunk Bed — 2 qavatli karavot" },
];

const roomTypeSchema = z.object({
  name: z.string().trim().min(2, "Nom kamida 2 ta belgidan iborat bo'lishi kerak"),
  description: z.string().max(300, "Tavsif ko'pi bilan 300 belgi bo'lishi mumkin").optional(),
  imageUrl: z.string().optional(),
  bedType: z.string().optional(),
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

export function RoomTypeDialog({
  open,
  onClose,
  editing,
  onSuccess,
}: RoomTypeDialogProps) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();

  const restaurant = isRestaurant(partnerType);
  const labels = getPartnerLabels(partnerType);
  const amenityOptions = restaurant ? TABLE_AMENITY_OPTIONS : ROOM_AMENITY_OPTIONS;

  const [uploadingImage, setUploadingImage] = useState(false);

  const form = useForm<RoomTypeFormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
      bedType: "",
      sizeSqm: undefined,
      basePrice: restaurant ? 0 : 300000,
      capacity: 2,
      amenities: [],
    },
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          name: editing.name,
          description: editing.description ?? "",
          imageUrl: editing.imageUrl ?? "",
          bedType: editing.bedType ?? "",
          sizeSqm: editing.sizeSqm ?? undefined,
          basePrice: editing.basePrice ?? 0,
          capacity: editing.capacity ?? 2,
          amenities: (editing.amenities as string[]) ?? [],
        });
      } else {
        form.reset({
          name: "",
          description: "",
          imageUrl: "",
          bedType: "",
          sizeSqm: undefined,
          basePrice: restaurant ? 0 : 300000,
          capacity: 2,
          amenities: [],
        });
      }
    }
  }, [open, editing, form, restaurant]);

  const selectedAmenities = useWatch({ control: form.control, name: "amenities" }) ?? [];
  const imageUrl = useWatch({ control: form.control, name: "imageUrl" }) ?? "";
  const bedTypeValue = useWatch({ control: form.control, name: "bedType" }) ?? "";

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

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        const updated = await updateRoomType.mutateAsync({
          id: editing.id,
          values: {
            name: values.name,
            description: values.description,
            imageUrl: values.imageUrl,
            bedType: values.bedType,
            sizeSqm: values.sizeSqm,
            basePrice: restaurant ? 0 : values.basePrice,
            capacity: values.capacity,
            amenities: values.amenities,
          },
        });
        toast.success(`"${values.name}" ma'lumotlari yangilandi`);
        onSuccess?.(updated);
        onClose();
        return;
      }

      const created = await createRoomType.mutateAsync({
        name: values.name,
        description: values.description,
        imageUrl: values.imageUrl,
        bedType: values.bedType,
        sizeSqm: values.sizeSqm,
        basePrice: restaurant ? 0 : values.basePrice,
        capacity: values.capacity,
        amenities: values.amenities,
      });


      toast.success(`Yangi ${labels.unitTypeLabel.toLowerCase()} "${values.name}" qo'shildi`);
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
          {/* 1. XONA/STOL TURI NOMI */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-name" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {labels.unitTypeLabel} nomi <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="rt-name"
                placeholder={
                  restaurant
                    ? "Masalan: Umumiy zal, VIP Kabinet, Terrasa..."
                    : "Masalan: Standard, Deluxe, Suite, Family Room..."
                }
                aria-invalid={Boolean(err.name)}
                list="room-type-presets"
                {...form.register("name")}
              />
              <datalist id="room-type-presets">
                {restaurant ? (
                  <>
                    <option value="Umumiy zal (Standard)" />
                    <option value="VIP Kabinet" />
                    <option value="Terrasa" />
                    <option value="Banket stoli" />
                    <option value="Bar stoli" />
                  </>
                ) : (
                  <>
                    <option value="Standard" />
                    <option value="Superior" />
                    <option value="Deluxe" />
                    <option value="Lux" />
                    <option value="Junior Suite" />
                    <option value="Suite" />
                    <option value="Family Room" />
                    <option value="Kottej" />
                    <option value="Ekoxona" />
                    <option value="Villa" />
                  </>
                )}
              </datalist>
            </div>
            {err.name && <p className="text-xs text-red-500">{err.name.message}</p>}
          </div>

          {/* 2. NARX VA SIG'IM (2 ustun) */}
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

          {/* 3. KARAVOT TURI VA MAYDONI (Faqat mehmonxona/hostel/dacha) */}
          {!restaurant && !labels.isBus && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-bed" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Karavot turi
                </Label>
                <Select
                  id="rt-bed"
                  placeholder="Tanlang (ixtiyoriy)"
                  value={bedTypeValue}
                  onChange={(e) =>
                    form.setValue("bedType", e.target.value, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  options={BED_TYPE_OPTIONS}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-size" className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} maydoni (m², ixtiyoriy)
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
            </div>
          )}

          {/* 4. QULAYLIKLAR VA JİHOZLAR */}
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

          {/* 5. RASM YUKLASH */}
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
