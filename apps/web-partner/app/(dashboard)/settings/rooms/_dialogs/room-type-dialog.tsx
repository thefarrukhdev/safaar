"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "../../../../_components/ui/button";
import { Dialog } from "../../../../_components/ui/dialog";
import { Input } from "../../../../_components/ui/input";
import { MoneyInput } from "../../../../_components/ui/money-input";
import { Label } from "../../../../_components/ui/label";
import { useAuthStore } from "../../../../_stores/auth-store";
import { useCreateRoomType, useUpdateRoomType } from "../../../../_hooks/use-room-types";
import { partners } from "../../../../_lib/api";
import { getPartnerLabels, hasBuses, isRestaurant } from "../../../../_lib/utils/partner-labels";
import type { RoomType } from "../../../../_lib/domain/types";

const ROOM_AMENITY_OPTIONS = [
  { value: "wifi", label: "Wi-Fi" },
  { value: "tv", label: "TV" },
  { value: "ac", label: "Konditsioner" },
  { value: "minibar", label: "Mini bar" },
  { value: "balcony", label: "Balkon" },
  { value: "kitchen", label: "Oshxona" },
  { value: "parking", label: "Parking" },
  { value: "breakfast", label: "Nonushta" },
  { value: "pool", label: "Hovuz" },
  { value: "spa", label: "Spa" },
  { value: "gym", label: "Sport zal" },
];

const TABLE_AMENITY_OPTIONS = [
  { value: "window", label: "Deraza yonida" },
  { value: "terrace", label: "Terrasa/tashqarida" },
  { value: "vip", label: "VIP xona" },
  { value: "quiet", label: "Tinch burchak" },
  { value: "near_stage", label: "Sahna/musiqa yonida" },
  { value: "high_chair", label: "Bolalar kursisi" },
  { value: "wheelchair", label: "Nogironlar aravachasiga qulay" },
  { value: "smoking", label: "Chekish joyi" },
];

const BUS_AMENITY_OPTIONS = [
  { value: "ac", label: "Konditsioner" },
  { value: "bluetooth", label: "Bluetooth Media" },
  { value: "leather", label: "Charm salon" },
  { value: "cruise", label: "Kruiz nazorati" },
  { value: "rear_camera", label: "Orqa ko'rinish kamerasi" },
  { value: "sunroof", label: "Lyuk/Panarama" },
  { value: "heated_seats", label: "O'rindiq isitgichi" },
  { value: "child_seat", label: "Bolalar o'rindig'i (ixtiyoriy)" },
  { value: "gps", label: "GPS Navigatsiya" },
];

const schema = z.object({
  name: z.string().min(2, "Nom kamida 2 belgi"),
  description: z.string().max(180, "Tavsif 180 belgidan oshmasin").optional(),
  imageUrl: z
    .string()
    .optional(),
  bedType: z.string().max(60, "Juda uzun").optional(),
  sizeSqm: z.number().min(0).max(500).optional(),
  basePrice: z.number().min(0, "Narx 0 dan kichik bo'lmasin"),
  capacity: z.number().int().min(1).max(10),
  amenities: z.array(z.string()),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: RoomType | null;
}

export function RoomTypeDialog({ open, onClose, editing }: Props) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();
  const [uploadingImage, setUploadingImage] = useState(false);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);
  const amenityOptions = isBus ? BUS_AMENITY_OPTIONS : restaurant ? TABLE_AMENITY_OPTIONS : ROOM_AMENITY_OPTIONS;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
      bedType: "",
      sizeSqm: undefined,
      basePrice: restaurant ? 0 : (undefined as unknown as number),
      capacity: 2,
      amenities: [],
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              name: editing.name,
              description: editing.description ?? "",
              imageUrl: editing.imageUrl ?? "",
              bedType: editing.bedType ?? "",
              sizeSqm: editing.sizeSqm,
              basePrice: editing.basePrice,
              capacity: editing.capacity,
              amenities: editing.amenities,
            }
          : {
              name: "",
              description: "",
              imageUrl: "",
              bedType: "",
              sizeSqm: undefined,
              basePrice: restaurant ? 0 : (undefined as unknown as number),
              capacity: 2,
              amenities: [],
            },
      );
    }
  }, [open, editing, form, restaurant]);

  const selectedAmenities =
    useWatch({ control: form.control, name: "amenities" }) ?? [];
  const imageUrl = useWatch({ control: form.control, name: "imageUrl" }) ?? "";

  const toggleAmenity = (value: string) => {
    const current = form.getValues("amenities");
    if (current.includes(value)) {
      form.setValue(
        "amenities",
        current.filter((a) => a !== value),
      );
    } else {
      form.setValue("amenities", [...current, value]);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const uploaded = await partners.uploadImage(file, accessToken);
      form.setValue("imageUrl", uploaded.url, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast.success("Rasm yuklandi");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Rasmni yuklab bo'lmadi",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await updateRoomType.mutateAsync({ id: editing.id, values });
        toast.success(`"${values.name}" yangilandi`);
      } else {
        await createRoomType.mutateAsync(values);
        toast.success(`"${values.name}" qo'shildi`);
      }
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Xona turini saqlab bo'lmadi",
      );
    }
  });

  const err = form.formState.errors;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `${labels.unitTypeLabel}ni tahrirlash` : `Yangi ${labels.unitTypeLabel.toLowerCase()}`}
      description={
        isBus
          ? "Masalan: Sedan, SUV, Miniven, Biznes klass"
          : restaurant
          ? "Masalan: 2 kishilik, Terrasa, VIP xona"
          : "Masalan: Standart, Lyuks, Family Suite"
      }
      size="lg"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-name">Nomi</Label>
            <Input
              id="rt-name"
              placeholder={isBus ? "Sedan" : "Standart"}
              aria-invalid={Boolean(err.name)}
              {...form.register("name")}
            />
            {err.name && (
              <p className="text-xs text-red-600">{err.name.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rt-capacity">{isBus ? "O'rindiqlar soni" : "Sig'imi (necha kishi)"}</Label>
            <Input
              id="rt-capacity"
              type="number"
              min={1}
              max={10}
              {...form.register("capacity", { valueAsNumber: true })}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="rt-desc">Qisqa tavsif</Label>
            <Input
              id="rt-desc"
              placeholder={isBus ? "Yangi, qulay salon, yoqilg'i tejamkor..." : restaurant ? "Deraza yonida, 4 kishilik..." : "Keng, balkonli xona..."}
              {...form.register("description")}
            />
            {err.description && (
              <p className="text-xs text-red-600">
                {err.description.message}
              </p>
            )}
          </div>

          {!restaurant && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-bed">{isBus ? "Uzatma (KPP)" : "Karavot turi"}</Label>
                <Input
                  id="rt-bed"
                  placeholder={isBus ? "Avtomat" : "1 king bed"}
                  {...form.register("bedType")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rt-size">{isBus ? "Bagaj hajmi (L)" : "Maydon (m²)"}</Label>
                <Input
                  id="rt-size"
                  type="number"
                  placeholder={isBus ? "500" : ""}
                  min={0}
                  max={500}
                  {...form.register("sizeSqm", {
                    setValueAs: (value) =>
                      value === "" ? undefined : Number(value),
                  })}
                />
              </div>
            </>
          )}

          {!restaurant && (
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="rt-price">
                {isBus ? "1 kunlik ijara narxi (so'm)" : "Bir kechalik narx (so'm)"}
              </Label>
              <MoneyInput
                id="rt-price"
                placeholder="400000"
                {...form.register("basePrice", { valueAsNumber: true })}
              />
              {err.basePrice && (
                <p className="text-xs text-red-600">
                  {err.basePrice.message}
                </p>
              )}
            </div>
          )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>{labels.unitSingular.charAt(0).toUpperCase()}{labels.unitSingular.slice(1)} rasmi</Label>
            <label className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-card border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] transition-colors hover:border-brand-500 hover:bg-[var(--surface)]">
              {imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
                  <ImageIcon className="h-8 w-8 transition-transform group-hover:scale-110" aria-hidden />
                  <span className="text-xs font-medium">Rasm tanlash uchun bosing</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleImageUpload(file);
                  }
                }}
              />
            </label>
            {uploadingImage && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Rasm yuklanmoqda...
              </p>
            )}
            {err.imageUrl && (
              <p className="text-xs text-red-600">{err.imageUrl.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Qulayliklar</Label>
          <div className="flex flex-wrap gap-2">
            {amenityOptions.map((a) => {
              const checked = selectedAmenities.includes(a.value);
              return (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => toggleAmenity(a.value)}
                  aria-pressed={checked}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    checked
                      ? "border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                      : "border-[var(--border)] bg-[var(--surface)] text-zinc-600 hover:bg-[var(--surface-muted)] dark:text-zinc-300"
                  }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            disabled={
              uploadingImage ||
              createRoomType.isPending ||
              updateRoomType.isPending
            }
          >
            {editing ? "Saqlash" : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
