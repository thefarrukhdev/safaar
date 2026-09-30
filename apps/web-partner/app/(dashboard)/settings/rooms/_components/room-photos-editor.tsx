"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../../_components/ui/button";
import { useAuthStore } from "../../../../_stores/auth-store";
import {
  useAddRoomPhoto,
  useDeleteRoomPhoto,
} from "../../../../_hooks/use-rooms";
import { type Room } from "../../../../_lib/domain/types";
import { partners } from "../../../../_lib/api";

export function RoomPhotosEditor({ room }: { room: Room }) {
  const addPhoto = useAddRoomPhoto();
  const deletePhoto = useDeleteRoomPhoto();
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const uploaded = await partners.uploadImage(file);
      await addPhoto.mutateAsync({
        roomId: room.id,
        fileId: uploaded.id,
      });
      toast.success("Rasm qo'shildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rasm yuklashda xatolik");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm("Rasmni o'chirishni xohlaysizmi?")) return;
    try {
      await deletePhoto.mutateAsync({ roomId: room.id, imageId });
      toast.success("Rasm o'chirildi");
    } catch (error) {
      toast.error("Rasmni o'chirib bo'lmadi");
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Xona rasmlari
        </h3>
        <div>
          <input
            type="file"
            id="room-image-upload"
            className="hidden"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
          />
          <label htmlFor="room-image-upload">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={uploading}
            >
              <span>
                <Plus className="mr-2 h-4 w-4" />
                {uploading ? "Yuklanmoqda..." : "Rasm qo'shish"}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {room.photos?.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {room.photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-zinc-100 dark:bg-zinc-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600/90 text-white opacity-0 backdrop-blur-sm transition-all hover:bg-red-600 hover:scale-105 group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-zinc-50/50 px-4 text-center dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-500">
            Hali hech qanday rasm yuklanmagan
          </p>
        </div>
      )}
    </div>
  );
}
