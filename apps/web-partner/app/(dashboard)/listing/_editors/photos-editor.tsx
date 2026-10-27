"use client";

import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Dialog } from "../../../_components/ui/dialog";
import { Drawer } from "../../../_components/ui/drawer";
import { EmptyState } from "../../../_components/ui/empty-state";
import { Input } from "../../../_components/ui/input";
import { Label } from "../../../_components/ui/label";
import { Tooltip } from "../../../_components/ui/tooltip";
import { useConfirm } from "../../../_components/ui/confirm-dialog";
import {
  useAddListingPhotos,
  useDeleteListingPhoto,
  useListing,
  useUpdateListingPhoto,
} from "../../../_hooks/use-listing";
import { useAuthStore } from "../../../_stores/auth-store";
import { hasBuses, isDacha, isRestaurant } from "../../../_lib/utils/partner-labels";
import { PhotoCategory } from "../../../_lib/domain/listing";
import { cn } from "../../../_lib/utils/cn";

const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  [PhotoCategory.FACADE]: "Fasad",
  [PhotoCategory.LOBBY]: "Lobbi",
  [PhotoCategory.ROOM]: "Xona",
  [PhotoCategory.BATHROOM]: "Hammom",
  [PhotoCategory.RESTAURANT]: "Restoran",
  [PhotoCategory.POOL]: "Hovuz",
  [PhotoCategory.GYM]: "Fitness",
  [PhotoCategory.SPA]: "Spa",
  [PhotoCategory.OTHER]: "Boshqa",
};

const RESTAURANT_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  [PhotoCategory.FACADE]: "Old tomoni",
  [PhotoCategory.LOBBY]: "Kutish zonasi",
  [PhotoCategory.ROOM]: "Zal ichi",
  [PhotoCategory.BATHROOM]: "Hojatxona",
  [PhotoCategory.RESTAURANT]: "Taomlar",
  [PhotoCategory.POOL]: "Hovuz",
  [PhotoCategory.GYM]: "Fitness",
  [PhotoCategory.SPA]: "Spa",
  [PhotoCategory.OTHER]: "Boshqa",
};

const BUS_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  [PhotoCategory.FACADE]: "Old ko'rinish",
  [PhotoCategory.LOBBY]: "Salon ichi",
  [PhotoCategory.ROOM]: "Avtomobil / Salon",
  [PhotoCategory.BATHROOM]: "Yukxona (Bagaj)",
  [PhotoCategory.RESTAURANT]: "Boshqaruv paneli",
  [PhotoCategory.POOL]: "Hovuz",
  [PhotoCategory.GYM]: "Fitness",
  [PhotoCategory.SPA]: "Spa",
  [PhotoCategory.OTHER]: "Boshqa",
};

const DACHA_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  [PhotoCategory.FACADE]: "Hovli va bino",
  [PhotoCategory.LOBBY]: "Dam olish xonasi (Zal)",
  [PhotoCategory.ROOM]: "Yotoqxona",
  [PhotoCategory.BATHROOM]: "Hammom / Sauna",
  [PhotoCategory.RESTAURANT]: "Oshxona / Mangal",
  [PhotoCategory.POOL]: "Basseyn",
  [PhotoCategory.GYM]: "Bilyard / O'yin xonasi",
  [PhotoCategory.SPA]: "Sauna / Fin hammomi",
  [PhotoCategory.OTHER]: "Boshqa",
};

export function PhotosEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useListing();
  const confirm = useConfirm();
  const deletePhoto = useDeleteListingPhoto();
  const updatePhoto = useUpdateListingPhoto();
  const [addOpen, setAddOpen] = useState(false);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);
  const dacha = isDacha(partnerType);
  const categoryLabel = restaurant
    ? RESTAURANT_CATEGORY_LABEL
    : isBus
      ? BUS_CATEGORY_LABEL
      : dacha
        ? DACHA_CATEGORY_LABEL
        : CATEGORY_LABEL;

  const sortedPhotos = [...data.photos].sort((a, b) => a.order - b.order);
  const busy = deletePhoto.isPending || updatePhoto.isPending;

  const handleDeletePhoto = async (photoId: string) => {
    const ok = await confirm({
      title: "Rasmni o'chirish",
      description: "Ushbu rasmni rostdan ham o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.",
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
    if (!ok) return;

    deletePhoto.mutate(photoId, {
      onSuccess: () => toast.success("Rasm o'chirildi"),
      onError: (error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Rasmni o'chirib bo'lmadi",
        );
      },
    });
  };
  const handleReorder = async (photoId: string, direction: "up" | "down") => {
    const idx = sortedPhotos.findIndex((photo) => photo.id === photoId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sortedPhotos.length) return;
    const reordered = [...sortedPhotos];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    try {
      await Promise.all(
        reordered.map((photo, order) =>
          updatePhoto.mutateAsync({
            imageId: photo.id,
            values: { sortOrder: order, isCover: photo.isCover },
          }),
        ),
      );
      toast.success("Tartib saqlandi");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Tartibni saqlab bo'lmadi",
      );
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Rasmlar"
        description="Yorug', sifatli rasmlar ko'proq bron olishga yordam beradi."
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Yopish
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Rasm qo'shish
            </Button>
          </>
        }
      >
        {sortedPhotos.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-10 w-10" aria-hidden />}
            title="Hozircha rasm yo'q"
            description={
              restaurant
                ? "Old tomon rasmi bilan boshlang — u asosiy rasm sifatida ishlatiladi."
                : "Fasad rasmi bilan boshlang — u asosiy rasm sifatida ishlatiladi."
            }
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden />
                Birinchi rasmni qo'shish
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedPhotos.map((photo, idx) => (
              <div
                key={photo.id}
                className={cn(
                  "group relative overflow-hidden rounded-card border bg-[var(--surface)]",
                  photo.isCover
                    ? "border-brand-500 ring-2 ring-brand-200 dark:ring-brand-900"
                    : "border-[var(--border)]",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={
                    photo.caption ||
                    (photo.category && categoryLabel[photo.category as PhotoCategory]
                      ? categoryLabel[photo.category as PhotoCategory]
                      : "Rasm")
                  }
                  className="aspect-video w-full object-cover"
                />

                {photo.isCover && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                    <Star className="h-3 w-3 fill-white" aria-hidden />
                    Asosiy
                  </span>
                )}

                <div className="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex flex-col gap-0.5">
                    {photo.category && categoryLabel[photo.category as PhotoCategory] ? (
                      <span className="text-xs font-semibold text-white">
                        {categoryLabel[photo.category as PhotoCategory]}
                      </span>
                    ) : null}
                    {photo.caption && (
                      <span className="text-[10px] text-white/80">
                        {photo.caption}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip content="Yuqoriga">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => void handleReorder(photo.id, "up")}
                        disabled={idx === 0 || busy}
                        aria-label="Yuqoriga"
                        className="h-8 w-8 bg-white/90 text-zinc-800 hover:bg-white"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Pastga">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => void handleReorder(photo.id, "down")}
                        disabled={idx === sortedPhotos.length - 1 || busy}
                        aria-label="Pastga"
                        className="h-8 w-8 bg-white/90 text-zinc-800 hover:bg-white"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                    {!photo.isCover && (
                      <Tooltip content="Asosiy qilish">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          onClick={() => {
                            updatePhoto.mutate(
                              { imageId: photo.id, values: { isCover: true } },
                              {
                                onSuccess: () =>
                                  toast.success("Asosiy rasm o'zgartirildi"),
                                onError: (error) => {
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Asosiy rasmni saqlab bo'lmadi",
                                  );
                                },
                              },
                            );
                          }}
                          aria-label="Asosiy qilish"
                          className="h-8 w-8 bg-white/90 text-amber-600 hover:bg-white"
                        >
                          <Star className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content="O'chirish">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => void handleDeletePhoto(photo.id)}
                        disabled={busy}
                        aria-label="O'chirish"
                        className="h-8 w-8 bg-white/90 text-red-600 hover:bg-white"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <AddPhotoDialog open={addOpen} onClose={() => setAddOpen(false)} partnerType={partnerType} />
    </>
  );
}

function AddPhotoDialog({
  open,
  onClose,
  partnerType,
}: {
  open: boolean;
  onClose: () => void;
  partnerType?: string | null;
}) {
  const addPhotos = useAddListingPhotos();
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);
  const dacha = isDacha(partnerType);
  const categoryLabel = restaurant
    ? RESTAURANT_CATEGORY_LABEL
    : isBus
      ? BUS_CATEGORY_LABEL
      : dacha
        ? DACHA_CATEGORY_LABEL
        : CATEGORY_LABEL;

  const reset = () => {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviewUrls([]);
    setCaption("");
    setSelectedCategory("");
    setIsDragging(false);
  };

  const handleFilesSelected = (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const fileList = Array.from(newFiles);
    const validImages = fileList.filter((f) => f.type.startsWith("image/"));

    if (validImages.length === 0) {
      toast.error("Faqat rasm formatidagi fayllarni yuklang (PNG, JPG, WEBP)");
      return;
    }

    setFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const uniqueNew = validImages.filter(
        (f) => !existingKeys.has(`${f.name}_${f.size}`),
      );

      if (uniqueNew.length === 0) {
        toast.info("Tanlangan rasmlar ro'yxatda allaqachon mavjud");
        return prev;
      }

      const newUrls = uniqueNew.map((f) => URL.createObjectURL(f));
      setPreviewUrls((prevUrls) => [...prevUrls, ...newUrls]);
      return [...prev, ...uniqueNew];
    });
  };

  const handleRemoveFile = (index: number) => {
    const urlToRemove = previewUrls[index];
    if (urlToRemove) URL.revokeObjectURL(urlToRemove);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0);
  const totalSizeFormatted =
    totalSizeBytes > 1024 * 1024
      ? `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(totalSizeBytes / 1024)} KB`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Kamida bitta rasm tanlang");
      return;
    }

    try {
      await addPhotos.mutateAsync({
        files,
        caption: caption.trim() || undefined,
        category: selectedCategory || undefined,
      });
      toast.success(
        files.length === 1
          ? "Rasm muvaffaqiyatli yuklandi"
          : `${files.length} ta rasm birdaniga muvaffaqiyatli yuklandi`,
      );
      reset();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Rasmlarni yuklab bo'lmadi",
      );
    }
  };

  const categoryOptions = [
    { value: "", label: "Kategoriya tanlang (ixtiyoriy)" },
    ...Object.entries(categoryLabel).map(([key, label]) => ({
      value: key,
      label,
    })),
  ];

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Rasmlar yuklash (Ommaviy)"
      description="Bir nechta rasmlarni birdaniga tanlang yoki sudrab olib keling (drag & drop)."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Dropzone */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              Rasmlarni tanlash (1 yoki bir nechta)
            </Label>
            {files.length > 0 && (
              <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400">
                {files.length} ta rasm tanlandi ({totalSizeFormatted})
              </span>
            )}
          </div>
          <label
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex min-h-[140px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all",
              isDragging
                ? "border-brand-500 bg-brand-50/80 ring-2 ring-brand-200 dark:bg-brand-950/30"
                : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-brand-500 hover:bg-[var(--surface)]",
            )}
          >
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                <ImageIcon className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Rasmlarni bu yerga sudrab tashlang yoki tanlash uchun bosing
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                PNG, JPG, WEBP formatlari qo'llab-quvvatlanadi. Bir nechta rasm tanlashingiz mumkin.
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {/* Tanlangan rasmlar ro'yxati (Prevyu galereyasi) */}
        {previewUrls.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <span>Tanlangan rasmlar prevyusi ({files.length} ta):</span>
              <button
                type="button"
                onClick={reset}
                className="text-[11px] text-red-500 hover:underline cursor-pointer"
              >
                Hammasini tozalash
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-2">
              {previewUrls.map((url, idx) => {
                const file = files[idx];
                const fileSize = file
                  ? file.size > 1024 * 1024
                    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.round(file.size / 1024)} KB`
                  : "";
                return (
                  <div
                    key={idx}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end justify-between p-1.5">
                      <span className="truncate text-[10px] text-white max-w-[80%] font-medium">
                        {file?.name} ({fileSize})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="rounded-full bg-red-600 p-1 text-white hover:bg-red-700 transition-colors cursor-pointer"
                        aria-label="Rasmni olib tashlash"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kategoriya va Izoh */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-cat">Kategoriya (ixtiyoriy)</Label>
            <select
              id="p-cat"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs focus:border-brand-600 focus:outline-none"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-cap">Izoh (ixtiyoriy)</Label>
            <Input
              id="p-cap"
              value={caption}
              placeholder={`Masalan: ${
                restaurant
                  ? "Zal yoki fasad ko'rinishi"
                  : isBus
                    ? "Avtomobil oldi yoki salon ko'rinishi"
                    : dacha
                      ? "Hovli yoki bino ko'rinishi"
                      : "Fasad yoki lobbi ko'rinishi"
              }`}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Bekor qilish
          </Button>
          <Button
            type="submit"
            disabled={files.length === 0 || addPhotos.isPending}
          >
            {addPhotos.isPending
              ? "Yuklanmoqda..."
              : files.length > 1
                ? `${files.length} ta rasmni yuklash`
                : "Yuklash"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
