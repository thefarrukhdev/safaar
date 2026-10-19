"use client";

import {
  Building2,
  Coins,
  ImageIcon,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useCreateRoomType, useUpdateRoomType } from "@/hooks/use-room-types";
import { useCreateRoom, useUpdateRoom, useRooms } from "@/hooks/use-rooms";
import { useGenerateBeds } from "@/hooks/use-beds";
import { partners } from "@/lib/api";
import { cn } from "@/lib/utils/cn";
import { getPartnerLabels, hasBeds, hasBuses, isRestaurant } from "@/lib/utils/partner-labels";
import { RoomStatus, type RoomType, type Room } from "@/lib/domain/types";

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

const HOTEL_ROOM_TYPES = [
  { value: "Standard", label: "Standard — standart xona" },
  { value: "Superior", label: "Superior — yaxshilangan standart xona" },
  { value: "Deluxe", label: "Deluxe — yuqori qulaylikdagi xona" },
  { value: "Lux", label: "Lux — premium xona" },
  { value: "Junior Suite", label: "Junior Suite — kichik suite" },
  { value: "Suite", label: "Suite — alohida yotoq va mehmonxona" },
  { value: "Family Room", label: "Family Room — oilaviy xona" },
  { value: "Apartment", label: "Apartment — oshxona/yashash maydoniga ega xona" },
];

const BED_TYPES = [
  { value: "Single Bed", label: "Single Bed — bir kishilik karavot" },
  { value: "Twin Beds", label: "Twin Beds — 2 ta alohida karavot" },
  { value: "Double Bed", label: "Double Bed — katta ikki kishilik karavot" },
  { value: "Queen Bed", label: "Queen Bed — keng karavot" },
  { value: "King Bed", label: "King Bed — eng katta karavot" },
  { value: "Bunk Bed", label: "Bunk Bed — ikki qavatli karavot" },
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
  capacity: z.number().int().min(1, "Kamida 1 kishi").max(50, "Ko'pi bilan 50 kishi"),
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

export function UnifiedRoomDialog({
  open,
  onClose,
  mode = "room",
  editing,
  editingPhysicalRoom,
}: Props) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const generateBeds = useGenerateBeds();
  const { data: activeRooms = [] } = useRooms();

  const isHostel = hasBeds(partnerType);
  const isBus = hasBuses(partnerType);
  const restaurant = isRestaurant(partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const amenityOptions = isBus ? BUS_AMENITY_OPTIONS : restaurant ? TABLE_AMENITY_OPTIONS : ROOM_AMENITY_OPTIONS;

  const [activeTab, setActiveTab] = useState<string>("general");
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
          amenities: (editing.amenities as string[]) || [],
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
  const nameValue = useWatch({ control: form.control, name: "name" }) ?? "";
  const bedTypeValue = useWatch({ control: form.control, name: "bedType" }) ?? "";

  const roomTypeOptions = [
    ...HOTEL_ROOM_TYPES,
    ...(nameValue && !HOTEL_ROOM_TYPES.some((rt) => rt.value === nameValue)
      ? [{ value: nameValue, label: `${nameValue} (Mavjud)` }]
      : []),
  ];

  const bedTypeOptions = [
    { value: "", label: "Tanlang (ixtiyoriy)" },
    ...BED_TYPES,
    ...(bedTypeValue && !BED_TYPES.some((bt) => bt.value === bedTypeValue)
      ? [{ value: bedTypeValue, label: `${bedTypeValue} (Mavjud)` }]
      : []),
  ];

  const toggleAmenity = (value: string) => {
    const current = form.getValues("amenities") || [];
    if (current.includes(value)) {
      form.setValue("amenities", current.filter((a) => a !== value), { shouldDirty: true });
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
      toast.error("Rasmni yuklab bo'lmadi");
    } finally {
      setUploadingImage(false);
    }
  };

  // Smart tab switcher on invalid form errors
  const handleFormError = (errors: typeof form.formState.errors) => {
    if (errors.name || errors.capacity || errors.roomNumber || errors.floor || errors.description) {
      setActiveTab("general");
    } else if (errors.basePrice || errors.sizeSqm || errors.bedType) {
      setActiveTab("pricing");
    } else if (errors.amenities || errors.imageUrl) {
      setActiveTab("amenities");
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      if (editingPhysicalRoom) {
        if (!values.roomNumber?.trim()) {
          toast.error("Xona raqami kiritilishi majburiy");
          setActiveTab("general");
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
          } as any,
        });
        toast.success(`Xona va tur ma'lumotlari yangilandi`);
        onClose();
        return;
      }

      if (editing && mode === "type-only") {
        // Faqat tur tahrirlash (Listing sahifasidagi "Tahrirlash" tugmasi)
        await updateRoomType.mutateAsync({ id: editing.id, values });
        toast.success(`"${values.name}" muvaffaqiyatli yangilandi`);
        onClose();
        return;
      }

      // Yangi tur yaratish
      const roomTypeName =
        values.name ||
        (restaurant
          ? `${values.capacity} kishilik stol`
          : `${unitCap} ${values.roomNumber || values.capacity + " kishilik"}`);

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
        const duplicate = activeRooms.find((r) => r.number === values.roomNumber);
        if (duplicate) {
          toast.error(`${unitCap} ${values.roomNumber} allaqachon mavjud. Boshqa raqam kiriting.`);
          setActiveTab("general");
          setSubmitting(false);
          return;
        }

        const created = await createRoom.mutateAsync({
          number: values.roomNumber,
          floor: values.floor ?? 1,
          status: RoomStatus.VACANT_CLEAN,
          isListed: true,
          roomTypeId: newRoomType.id,
        } as any);

        if (isHostel) {
          await generateBeds.mutateAsync({ roomId: created.id, count: values.capacity });
        }

        toast.success(`"${roomTypeName}" va ${unitCap} ${values.roomNumber} e'longa chiqarildi!`);
      } else {
        toast.success(
          `"${roomTypeName}" varianti qo'shildi. Xonalar bo'limidan xona raqamlarini qo'shishingiz mumkin.`,
        );
      }

      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  }, handleFormError);

  const err = form.formState.errors;
  const isLoading = submitting || uploadingImage;

  const title = editingPhysicalRoom
    ? `${unitCap} ${editingPhysicalRoom.number} ni tahrirlash`
    : editing
      ? `${labels.unitTypeLabel}ni tahrirlash`
      : mode === "room"
        ? `Yangi ${labels.unitSingular} qo'shish`
        : `Yangi ${labels.unitTypeLabel.toLowerCase()}`;

  const description = editingPhysicalRoom
    ? `Xona raqami va tegishli parametrlarini yangilang.`
    : editing
      ? `${labels.unitTypeLabel} ma'lumotlarini tahrirlash`
      : mode === "room"
        ? `${unitCap} parametrlari va e'lon ma'lumotlarini to'ldiring.`
        : `Yangi tur va narx parametrlarini kiriting.`;

  const handleClose = () => {
    setActiveTab("general");
    onClose();
  };

  const handleNextTab = async () => {
    if (activeTab === "general") {
      const valid = await form.trigger(["name", "capacity", "roomNumber", "floor", "description"]);
      if (valid) {
        setActiveTab("pricing");
      }
    } else if (activeTab === "pricing") {
      const valid = await form.trigger(["basePrice", "sizeSqm", "bedType"]);
      if (valid) {
        setActiveTab("amenities");
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">
              {activeTab === "general" ? "1 / 3 qadam" : activeTab === "pricing" ? "2 / 3 qadam" : "3 / 3 qadam"}
            </span>
            {activeTab !== "general" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab(activeTab === "amenities" ? "pricing" : "general")}
                className="h-8 px-2 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              >
                &larr; Ortga
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Bekor qilish
            </Button>
            {activeTab !== "amenities" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isLoading}
                onClick={handleNextTab}
              >
                Keyingisi &rarr;
              </Button>
            ) : null}
            <Button
              type="submit"
              form="unified-room-form"
              variant="primary"
              disabled={isLoading}
              loading={isLoading}
            >
              {editing
                ? "Saqlash"
                : mode === "room"
                  ? "Qo'shish va e'longa chiqarish"
                  : "Variant qo'shish"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="unified-room-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <fieldset disabled={isLoading} className="flex flex-col gap-4 group-disabled:opacity-70">
          {/* Apple/Linear Segments Tabs Navigation */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            variant="segmented"
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 p-1">
              <TabsTrigger value="general" className="gap-1.5 sm:gap-2 px-1 sm:px-3 text-xs">
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                <span className="truncate">Asosiy</span>
                {(err.name || err.capacity || err.roomNumber || err.floor || err.description) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                )}
              </TabsTrigger>
              <TabsTrigger value="pricing" className="gap-1.5 sm:gap-2 px-1 sm:px-3 text-xs">
                <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                <span className="truncate">
                  <span className="inline sm:hidden">Narx</span>
                  <span className="hidden sm:inline">Narx & Parametrlar</span>
                </span>
                {(err.basePrice || err.sizeSqm || err.bedType) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                )}
              </TabsTrigger>
              <TabsTrigger value="amenities" className="gap-1.5 sm:gap-2 px-1 sm:px-3 text-xs">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" aria-hidden />
                <span className="truncate">
                  <span className="inline sm:hidden">Qulaylik</span>
                  <span className="hidden sm:inline">Qulaylik & Rasm</span>
                </span>
                {(err.amenities || err.imageUrl) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                )}
              </TabsTrigger>
            </TabsList>

            {/* ─── TAB 1: ASOSIY MA'LUMOTLAR ─── */}
            <TabsContent value="general" className="mt-3 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Tur / Model nomi */}
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="ur-name">
                    {isBus ? "Avtomobil modeli" : restaurant ? "Stol nomi" : "Xona turi nomi"}
                  </Label>
                  {isBus || restaurant ? (
                    <Input
                      id="ur-name"
                      placeholder={isBus ? "Sedan, Miniven, SUV..." : "2 kishilik, VIP, Terrasa..."}
                      aria-invalid={Boolean(err.name)}
                      {...form.register("name")}
                    />
                  ) : (
                    <Select
                      id="ur-name"
                      placeholder="Xona turini tanlang"
                      value={nameValue}
                      error={Boolean(err.name)}
                      onChange={(e) =>
                        form.setValue("name", e.target.value, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      options={roomTypeOptions}
                    />
                  )}
                  {err.name && <p className="text-xs text-red-600 dark:text-red-400">{err.name.message}</p>}
                </div>

                {/* Sig'im */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ur-capacity">
                    {isBus ? "O'rindiqlar soni" : "Sig'imi (kishi)"}
                  </Label>
                  <Input
                    id="ur-capacity"
                    type="number"
                    min={1}
                    max={50}
                    aria-invalid={Boolean(err.capacity)}
                    {...form.register("capacity", {
                      setValueAs: (v) => (v === "" || isNaN(Number(v)) ? 1 : Number(v)),
                    })}
                  />
                  {err.capacity && (
                    <p className="text-xs text-red-600 dark:text-red-400">{err.capacity.message}</p>
                  )}
                </div>

                {/* Qisqa tavsif */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ur-desc">Qisqa tavsif (ixtiyoriy)</Label>
                  <Input
                    id="ur-desc"
                    placeholder={isBus ? "Tejamkor, konditsioner..." : "Keng, dengiz manzarali..."}
                    {...form.register("description")}
                  />
                </div>
              </div>

              {/* Fizik xona ma'lumotlari (faqat room rejimida) */}
              {mode === "room" && (!editing || editingPhysicalRoom) && (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      {isBus
                        ? "Davlat raqami va ma'lumotlari"
                        : `${unitCap} raqami va joylashuvi`}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Darhol faollashadi
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ur-number">
                        {isBus ? "Davlat raqami / Bort ID" : restaurant ? "Stol raqami" : "Xona raqami"}
                      </Label>
                      <Input
                        id="ur-number"
                        placeholder={
                          isBus ? "01 A 777 AA" : restaurant ? "Stol-12, VIP-1" : "101, 204, 302..."
                        }
                        {...form.register("roomNumber")}
                      />
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Bo'sh qoldirilsa faqat e'lon varianti saqlanadi
                      </p>
                    </div>

                    {!isBus && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="ur-floor">
                          {labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}
                        </Label>
                        <Input
                          id="ur-floor"
                          type="number"
                          min={1}
                          max={50}
                          {...form.register("floor", {
                            setValueAs: (v) => (v === "" || isNaN(Number(v)) ? 1 : Number(v)),
                          })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── TAB 2: NARX & PARAMETRLAR ─── */}
            <TabsContent value="pricing" className="mt-3 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {!restaurant && (
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="ur-price">
                      {isBus ? "1 kunlik ijara narxi (so'm)" : "Bir kechalik narx (so'm)"}
                    </Label>
                    <Controller
                      control={form.control}
                      name="basePrice"
                      render={({ field }) => (
                        <MoneyInput
                          id="ur-price"
                          placeholder="400 000"
                          value={field.value}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          aria-invalid={Boolean(err.basePrice)}
                        />
                      )}
                    />
                    {err.basePrice && (
                      <p className="text-xs text-red-600 dark:text-red-400">{err.basePrice.message}</p>
                    )}
                  </div>
                )}

                {!restaurant && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ur-bed">
                        {isBus ? "Uzatma qutisi (KPP)" : "Karavot turi"}
                      </Label>
                      {isBus ? (
                        <Input
                          id="ur-bed"
                          placeholder="Avtomat / Mexanika"
                          {...form.register("bedType")}
                        />
                      ) : (
                        <Select
                          id="ur-bed"
                          placeholder="Karavot turini tanlang (ixtiyoriy)"
                          value={bedTypeValue}
                          onChange={(e) =>
                            form.setValue("bedType", e.target.value, {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }
                          options={bedTypeOptions}
                        />
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="ur-size">
                        {isBus ? "Bagaj hajmi (litr)" : "Xona maydoni (m²)"}
                      </Label>
                      <Input
                        id="ur-size"
                        type="number"
                        min={0}
                        max={500}
                        placeholder={isBus ? "450" : "28"}
                        {...form.register("sizeSqm", {
                          setValueAs: (v) => (v === "" ? undefined : Number(v)),
                        })}
                      />
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* ─── TAB 3: QULAYLIKLAR & RASM ─── */}
            <TabsContent value="amenities" className="mt-3 flex flex-col gap-4">
              {/* Rasm Yuklash / Ko'rish */}
              <div className="flex flex-col gap-2">
                <Label>Rasm (turistlarga ko'rinadi)</Label>
                <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                  <label className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 transition-all hover:border-brand-500">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt="Xona rasmi"
                        className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-85"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1.5 p-3 text-center text-zinc-400">
                        <ImageIcon className="h-7 w-7 text-zinc-400 group-hover:text-brand-500 transition-colors" aria-hidden />
                        <span className="text-xs font-medium">Rasm tanlash</span>
                        <span className="text-[10px] text-zinc-400">JPG, PNG, WebP</span>
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

                  <div className="flex flex-col justify-between py-1">
                    <div className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                      Sifatli va yorug' fotosurat xona e'lonining bron qilinish ehtimolini bir necha barobarga oshiradi.
                    </div>
                    {imageUrl && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => form.setValue("imageUrl", "", { shouldDirty: true })}
                          className="h-8 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Rasmni o'chirish
                        </Button>
                      </div>
                    )}
                    {uploadingImage && (
                      <p className="text-xs font-medium text-brand-600 dark:text-brand-400 animate-pulse">
                        Rasm yuklanmoqda...
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Qulayliklar Chips */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <Label>Qulayliklar va jihozlar</Label>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
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
                          "rounded-full h-7 px-3 text-xs font-medium transition-all duration-150",
                          checked
                            ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-950/60 dark:text-brand-300 dark:border-brand-500/80"
                            : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
                        )}
                      >
                        {a.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>

        </fieldset>
      </form>
    </Dialog>
  );
}
