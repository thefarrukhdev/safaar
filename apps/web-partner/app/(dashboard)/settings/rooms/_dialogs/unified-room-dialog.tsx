"use client";

import { ImageIcon, X } from "lucide-react";
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
import { useCreateRoom, useUpdateRoom, useRooms } from "../../../../_hooks/use-rooms";
import { useGenerateBeds } from "../../../../_hooks/use-beds";
import { partners } from "../../../../_lib/api";
import { getPartnerLabels, hasBeds, hasBuses, isRestaurant } from "../../../../_lib/utils/partner-labels";
import { RoomStatus, type RoomType, type Room } from "../../../../_lib/domain/types";

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

// Mode: 'room' — xonalar bo'limidan, 'type-only' — listing/e'lon bo'limidan (faqat tur tahrirlash)
export type UnifiedRoomDialogMode = "room" | "type-only";

const schema = z.object({
  // Room type fields (e'lon ma'lumotlari)
  name: z.string().min(2, "Nom kamida 2 belgi"),
  description: z.string().max(180).optional(),
  imageUrl: z.string().optional(),
  bedType: z.string().max(60).optional(),
  sizeSqm: z.number().min(0).max(500).optional(),
  basePrice: z.number().min(0, "Narx 0 dan kichik bo'lmasin"),
  capacity: z.number().int().min(1).max(50),
  amenities: z.array(z.string()),
  // Physical room fields (xona ma'lumotlari)
  roomNumber: z.string().optional(),
  floor: z.number().int().min(1).max(50).optional(),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: UnifiedRoomDialogMode;
  editing?: RoomType | null; // editing room type (for type-only mode)
  editingPhysicalRoom?: Room | null; // physical room being edited
}

export function UnifiedRoomDialog({ open, onClose, mode = "room", editing, editingPhysicalRoom }: Props) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const generateBeds = useGenerateBeds();
  const { data: activeRooms } = useRooms();
  const isHostel = hasBeds(partnerType);
  const isBus = hasBuses(partnerType);
  const restaurant = isRestaurant(partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const amenityOptions = isBus ? BUS_AMENITY_OPTIONS : restaurant ? TABLE_AMENITY_OPTIONS : ROOM_AMENITY_OPTIONS;

  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      roomNumber: "",
      floor: 1,
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
          sizeSqm: editing.sizeSqm,
          basePrice: editing.basePrice,
          capacity: editing.capacity,
          amenities: editing.amenities as string[],
          roomNumber: editingPhysicalRoom?.number || "",
          floor: editingPhysicalRoom?.floor || 1,
        });
      } else {
        form.reset({
          name: "",
          description: "",
          imageUrl: "",
          bedType: "",
          sizeSqm: undefined,
          basePrice: restaurant ? 0 : (undefined as unknown as number),
          capacity: 2,
          amenities: [],
          roomNumber: "",
          floor: 1,
        });
      }
    }
  }, [open, editing, editingPhysicalRoom, form, restaurant]);

  const selectedAmenities = useWatch({ control: form.control, name: "amenities" }) ?? [];
  const imageUrl = useWatch({ control: form.control, name: "imageUrl" }) ?? "";

  const toggleAmenity = (value: string) => {
    const current = form.getValues("amenities");
    if (current.includes(value)) {
      form.setValue("amenities", current.filter((a) => a !== value));
    } else {
      form.setValue("amenities", [...current, value]);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const uploaded = await partners.uploadImage(file, accessToken);
      form.setValue("imageUrl", uploaded.url, { shouldDirty: true, shouldValidate: true });
      toast.success("Rasm yuklandi");
    } catch {
      toast.error("Rasmni yuklab bo'lmadi");
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      if (editingPhysicalRoom) {
        if (!values.roomNumber?.trim()) {
          toast.error("Xona raqami kiritilishi majburiy");
          setSubmitting(false);
          return;
        }
        // Update both RoomType and Physical Room
        if (editing) {
          await updateRoomType.mutateAsync({ id: editing.id, values });
        }
        await updateRoom.mutateAsync({
          id: editingPhysicalRoom.id,
          values: {
            number: values.roomNumber,
            floor: values.floor,
            roomTypeId: editing?.id,
            isListed: editingPhysicalRoom.isListed,
            status: editingPhysicalRoom.status,
          } as any
        });
        toast.success(`Xona va tur ma'lumotlari yangilandi`);
        onClose();
        return;
      }

      if (editing && mode === "type-only") {
        // Faqat tur tahrirlash (Listing sahifasidagi "Tahrirlash" tugmasi)
        await updateRoomType.mutateAsync({ id: editing.id, values });
        toast.success(`"${values.name}" yangilandi`);
        onClose();
        return;
      }

      // Yangi tur yaratish
      const roomTypeName = values.name || 
        (restaurant ? `${values.capacity} kishilik stol` : `${unitCap} ${values.roomNumber || values.capacity + " kishilik"}`);

      const newRoomType = await createRoomType.mutateAsync({
        name: roomTypeName,
        description: values.description,
        imageUrl: values.imageUrl,
        bedType: values.bedType,
        sizeSqm: values.sizeSqm,
        basePrice: values.basePrice,
        capacity: values.capacity,
        amenities: values.amenities,
      });

      // Agar xona raqami kiritilgan bo'lsa (room mode) — fizik xona ham qo'shish
      if (mode === "room" && values.roomNumber) {
        // Avval bir xil raqamdagi active xona borligini tekshiramiz
        const duplicate = activeRooms.find(r => r.number === values.roomNumber);
        if (duplicate) {
          toast.error(`${unitCap} ${values.roomNumber} allaqachon mavjud. Boshqa raqam kiriting.`);
          setSubmitting(false);
          return;
        }

        const created = await createRoom.mutateAsync({
          number: values.roomNumber,
          floor: values.floor ?? 1,
          status: RoomStatus.VACANT_CLEAN,
          isListed: true, // to'g'ridan to'g'ri e'londa!
          roomTypeId: newRoomType.id,
        } as any);

        if (isHostel) {
          await generateBeds.mutateAsync({ roomId: created.id, count: values.capacity });
        }

        toast.success(`"${roomTypeName}" va ${unitCap} ${values.roomNumber} e'longa chiqarildi!`);
      } else {
        // Faqat tur yaratildi (listing sahifasidan "yangi variant")
        toast.success(`"${roomTypeName}" varianti qo'shildi. Xonalar bo'limidan xona raqamlarini qo'shishingiz mumkin.`);
      }

      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  });

  const err = form.formState.errors;
  const isLoading = submitting || uploadingImage;

  const title = editingPhysicalRoom 
    ? `${unitCap} ${editingPhysicalRoom.number} va uning turini tahrirlash`
    : editing
      ? `${labels.unitTypeLabel}ni tahrirlash`
      : mode === "room"
        ? `Yangi ${labels.unitSingular} qo'shish`
        : `Yangi ${labels.unitTypeLabel.toLowerCase()}`;

  const description = editingPhysicalRoom
    ? `Diqqat: Xona turi o'zgartirilsa, shunga o'xshash boshqa xonalarning ham turi o'zgaradi.`
    : editing
      ? `${labels.unitTypeLabel} ma'lumotlarini tahrirlash`
    : mode === "room"
      ? `${unitCap} ma'lumotlari va e'lon uchun to'liq ma'lumot kiriting. Xona darhol e'longa chiqariladi.`
      : isBus ? "Masalan: Sedan, SUV, Miniven, Biznes klass"
        : restaurant ? "Masalan: 2 kishilik, Terrasa, VIP xona"
          : "Masalan: Standart, Lyuks, Family Suite";

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <fieldset disabled={isLoading} className="flex flex-col gap-5 group-disabled:opacity-70">
        {/* ─── E'LON MA'LUMOTLARI ─── */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
            E'lon ma'lumotlari (turistlar ko'radi)
          </p>
          <div className="grid gap-4 md:grid-cols-[1fr_160px]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ur-name">
                  {isBus ? "Avtomobil modeli" : restaurant ? "Stol nomi" : "Xona turi nomi"}
                </Label>
                <Input
                  id="ur-name"
                  placeholder={isBus ? "Sedan, Miniven..." : restaurant ? "2 kishilik, VIP..." : "Standart, Lyuks..."}
                  aria-invalid={Boolean(err.name)}
                  {...form.register("name")}
                />
                {err.name && <p className="text-xs text-red-600">{err.name.message}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ur-capacity">
                  {isBus ? "O'rindiqlar soni" : "Sig'imi (necha kishi)"}
                </Label>
                <Input
                  id="ur-capacity"
                  type="number"
                  min={1}
                  max={50}
                  {...form.register("capacity", { valueAsNumber: true })}
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <Label htmlFor="ur-desc">Qisqa tavsif (ixtiyoriy)</Label>
                <Input
                  id="ur-desc"
                  placeholder={isBus ? "Qulay, tejamkor..." : "Keng, balkonli..."}
                  {...form.register("description")}
                />
              </div>

              {!restaurant && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ur-bed">{isBus ? "Uzatma (KPP)" : "Karavot turi"}</Label>
                    <Input
                      id="ur-bed"
                      placeholder={isBus ? "Avtomat" : "1 king bed"}
                      {...form.register("bedType")}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="ur-size">{isBus ? "Bagaj hajmi (L)" : "Maydon (m²)"}</Label>
                    <Input
                      id="ur-size"
                      type="number"
                      min={0}
                      max={500}
                      {...form.register("sizeSqm", {
                        setValueAs: (v) => (v === "" ? undefined : Number(v)),
                      })}
                    />
                  </div>
                </>
              )}

              {!restaurant && (
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label htmlFor="ur-price">
                    {isBus ? "1 kunlik ijara narxi (so'm)" : "Bir kechalik narx (so'm)"}
                  </Label>
                  <MoneyInput
                    id="ur-price"
                    placeholder="400000"
                    aria-invalid={Boolean(err.basePrice)}
                    {...form.register("basePrice", { valueAsNumber: true })}
                  />
                  {err.basePrice && <p className="text-xs text-red-600">{err.basePrice.message}</p>}
                </div>
              )}
            </div>

            {/* Rasm */}
            <div className="flex flex-col gap-2">
              <Label>Rasm</Label>
              <label className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-card border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] transition-colors hover:border-brand-500">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="h-full w-full object-cover transition-opacity group-hover:opacity-80" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
                    <ImageIcon className="h-8 w-8" aria-hidden />
                    <span className="text-xs font-medium text-center px-2">Rasm tanlash</span>
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
              {uploadingImage && <p className="text-xs text-[var(--muted-foreground)]">Yuklanmoqda...</p>}
            </div>
          </div>
        </div>

        {/* ─── QULAYLIKLAR ─── */}
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

        {/* ─── FIZIK XONA MA'LUMOTLARI (faqat room mode da) ─── */}
        {mode === "room" && (!editing || editingPhysicalRoom) && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
              Xona raqami va joylashuvi (ichki boshqaruv)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ur-number">
                  {isBus ? "Davlat raqami / ID" : restaurant ? "Stol raqami" : "Xona raqami"}
                </Label>
                <Input
                  id="ur-number"
                  placeholder={isBus ? "01A-234-BC" : restaurant ? "1, 2A, VIP-1..." : "101, 202, A1..."}
                  {...form.register("roomNumber")}
                />
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  Bo'sh qoldirsangiz faqat e'lon varianti yaratiladi
                </p>
              </div>
              {!isBus && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ur-floor">{labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}</Label>
                  <Input
                    id="ur-floor"
                    type="number"
                    min={1}
                    max={50}
                    {...form.register("floor", { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>
            <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-950/30 dark:text-green-200">
              ✅ Xona raqami kiritilsa, u <strong>darhol e'longa chiqariladi</strong> — turistlar bron qila oladi.
            </div>
          </div>
        )}

        {/* ─── TUGMALAR ─── */}
        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? "Saqlanmoqda..."
              : editing
                ? "Saqlash"
                : mode === "room"
                  ? "Qo'shish va e'longa chiqarish"
                  : "Variant qo'shish"}
          </Button>
        </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
