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
  useAddListingPhoto,
  useDeleteListingPhoto,
  useListing,
  useUpdateListingPhoto,
} from "../../../_hooks/use-listing";
import { useAuthStore } from "../../../_stores/auth-store";
import { isRestaurant } from "../../../_lib/utils/partner-labels";
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

/** Restoran uchun ma'nosiz kategoriyalar (hovuz/fitness/spa) tanlovdan chetlatiladi. */
const RESTAURANT_VISIBLE_CATEGORIES: PhotoCategory[] = [
  PhotoCategory.FACADE,
  PhotoCategory.LOBBY,
  PhotoCategory.ROOM,
  PhotoCategory.BATHROOM,
  PhotoCategory.RESTAURANT,
  PhotoCategory.OTHER,
];

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
  const categoryLabel = restaurant ? RESTAURANT_CATEGORY_LABEL : CATEGORY_LABEL;

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
                  alt={photo.caption ?? categoryLabel[photo.category]}
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
                    <span className="text-xs font-semibold text-white">
                      {categoryLabel[photo.category]}
                    </span>
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

      <AddPhotoDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function AddPhotoDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addPhoto = useAddListingPhoto();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const restaurant = isRestaurant(partnerType);
  const categoryLabel = restaurant ? RESTAURANT_CATEGORY_LABEL : CATEGORY_LABEL;
  const visibleCategories = restaurant
    ? RESTAURANT_VISIBLE_CATEGORIES
    : (Object.values(PhotoCategory) as PhotoCategory[]);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<PhotoCategory>(PhotoCategory.FACADE);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl("");
    setCaption("");
    setCategory(PhotoCategory.FACADE);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Rasm tanlang");
      return;
    }
    try {
      await addPhoto.mutateAsync({
        file,
        draft: { url: "", caption: caption.trim() || undefined, category },
      });
      toast.success("Rasm qo'shildi");
      reset();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rasm qo'shib bo'lmadi");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Yangi rasm"
      description="Yangi rasmni tanlang. Yuklash real backend'da ulanadi."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Qurilmadan rasm yuklash</Label>
          <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] transition-colors hover:border-brand-500 hover:bg-[var(--surface)]">
            <ImageIcon className="mb-2 h-8 w-8 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-600">Rasm tanlash uchun bosing</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                }
              }}
              required={!file}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-cat">Kategoriya</Label>
          <select
            id="p-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as PhotoCategory)}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
          >
            {visibleCategories.map((key) => (
              <option key={key} value={key}>
                {categoryLabel[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="p-cap">Izoh (ixtiyoriy)</Label>
          <Input
            id="p-cap"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        {previewUrl && (
          <div className="rounded-card border border-[var(--border)] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="preview"
              className="max-h-40 w-full rounded object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" disabled={addPhoto.isPending}>
            Qo'shish
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
