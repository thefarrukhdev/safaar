"use client";

import { useEffect, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "../../../../_components/ui/button";
import { Dialog } from "../../../../_components/ui/dialog";
import { Input } from "../../../../_components/ui/input";
import { Label } from "../../../../_components/ui/label";
import { useAuthStore } from "../../../../_stores/auth-store";
import {
  useCreateRoom,
  useDeleteRoom,
  useRooms,
  useUpdateRoom,
} from "../../../../_hooks/use-rooms";
import { useRoomTypes, useCreateRoomType, useUpdateRoomType } from "../../../../_hooks/use-room-types";
import { useGenerateBeds } from "../../../../_hooks/use-beds";
import { RoomStatus, type Room } from "../../../../_lib/domain/types";
import { roomStatusLabel } from "../../../../_components/domain/room-status-badge";
import { getPartnerLabels, hasBeds, hasBuses, isRestaurant } from "../../../../_lib/utils/partner-labels";
import { partners } from "../../../../_lib/api";
import { getPrimaryHotel } from "../../../../_hooks/use-primary-hotel";
import { RoomPhotosEditor } from "../_components/room-photos-editor";

const schema = z.object({
  number: z.string().min(1, "Raqam/nomini kiriting"),
  floor: z.number().int().min(1).max(50),
  status: z.enum(RoomStatus),
  isListed: z.boolean(),
  roomTypeId: z.string().min(1, "Xona turini tanlang"),
});



const roomStatusOptions = Object.values(RoomStatus);

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Room | null;
}

export function RoomDialog({ open, onClose, editing }: Props) {
  const { data: roomTypes } = useRoomTypes();
  const { data: rooms, allRooms } = useRooms();
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();
  const generateBeds = useGenerateBeds();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const isHostel = hasBeds(partnerType);
  const isBus = hasBuses(partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);

  const [uploading, setUploading] = useState(false);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      number: "",
      floor: 1,
      status: RoomStatus.VACANT_CLEAN,
      isListed: true,
      roomTypeId: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        editing
          ? {
              number: editing.number,
              floor: editing.floor,
              status: editing.status,
              isListed: editing.isListed,
              roomTypeId: editing.roomTypeId,
            }
          : {
              number: "",
              floor: 1,
              status: RoomStatus.VACANT_CLEAN,
              isListed: true,
              roomTypeId: roomTypes[0]?.id || "",
            }
      );
    }
  }, [open, editing, form, roomTypes]);

  const onSubmit = form.handleSubmit(async (values) => {
    // Check for duplicates in active rooms
    const activeDuplicate = rooms.find(
      (room) => room.number === values.number && room.id !== editing?.id,
    );
    if (activeDuplicate) {
      toast.error(`${unitCap} ${values.number} allaqachon mavjud.`);
      return;
    }

    // Check for soft-deleted room with same number
    const inactiveDuplicate = !editing 
      ? allRooms.find(r => r.number === values.number && (r as any)._rawStatus === 'inactive')
      : undefined;

    try {
      setUploading(true);

      const submitValues = {
        number: values.number,
        floor: values.floor,
        status: values.status,
        isListed: values.isListed,
        roomTypeId: values.roomTypeId,
      };

      if (editing) {
        await updateRoom.mutateAsync({ id: editing.id, values: submitValues });
        toast.success(`${unitCap} ${values.number} yangilandi`);
      } else if (inactiveDuplicate) {
        await updateRoom.mutateAsync({ id: inactiveDuplicate.id, values: submitValues });
        if (isHostel) {
          const rt = roomTypes.find((r) => r.id === submitValues.roomTypeId);
          await generateBeds.mutateAsync({
            roomId: inactiveDuplicate.id,
            count: rt?.capacity ?? 2,
          });
        }
        toast.success(`${unitCap} ${values.number} tiklandi va qo'shildi`);
      } else {
        const created = await createRoom.mutateAsync(submitValues as any);
        if (isHostel) {
          const rt = roomTypes.find((r) => r.id === values.roomTypeId);
          await generateBeds.mutateAsync({
            roomId: created.id,
            count: rt?.capacity ?? 2,
          });
        }
        toast.success(`${unitCap} ${values.number} qo'shildi`);
      }
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Xonani saqlab bo'lmadi",
      );
    } finally {
      setUploading(false);
    }
  });

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`Rostdan ham ${labels.unitSingular} ${editing.number} ni o'chirmoqchimisiz?`)) return;
    try {
      // BIZNES MANTIQ UCHUN FRONTEND-HACK: Xonani rostdan o'chirilganini bilish uchun nomini o'zgartiramiz
      // Chunki backendda "o'chirilgan" va "yashirilgan" bir xil (inactive/is_listed=false)
      await updateRoom.mutateAsync({
        id: editing.id,
        values: { 
          number: `DELETED_${Date.now()}_${editing.number}`
        }
      });
      await deleteRoom.mutateAsync(editing.id);
      toast.success(`${unitCap} ${editing.number} o'chirildi.`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "O'chirib bo'lmadi",
      );
    }
  };

  const submitting =
    uploading ||
    createRoom.isPending ||
    updateRoom.isPending ||
    deleteRoom.isPending ||
    generateBeds.isPending;

  const err = form.formState.errors;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `${unitCap} ${editing.number}` : `Yangi ${labels.unitSingular}`}
      description={
        editing
          ? `${unitCap} ma'lumotlarini tahrirlash`
          : isHostel
            ? "Yotoqlar soni tanlangan xona turining sig'imiga qarab avtomatik yaratiladi."
            : `Ro'yxatingizga yangi ${labels.unitSingular} qo'shish`
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-number">{labels.unitIdentifierLabel}</Label>
            <Input
              id="r-number"
              placeholder={labels.unitIdentifierPlaceholder}
              aria-invalid={Boolean(err.number)}
              {...form.register("number")}
            />
            {err.number && (
              <p className="text-xs text-red-600">{err.number.message}</p>
            )}
          </div>
          {!isBus && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-floor">{labels.floorSingular.charAt(0).toUpperCase() + labels.floorSingular.slice(1)}</Label>
              <Input
                id="r-floor"
                type="number"
                min={1}
                max={50}
                {...form.register("floor", { valueAsNumber: true })}
              />
            </div>
          )}

          {roomTypes.length > 0 ? (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="r-room-type">{labels.unitTypeLabel}</Label>
              <select
                id="r-room-type"
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
                {...form.register("roomTypeId")}
                disabled={Boolean(editing)}
              >
                {!editing && <option value="">Tanlang...</option>}
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
              {err.roomTypeId && (
                <p className="text-xs text-red-600">{err.roomTypeId.message}</p>
              )}
            </div>
          ) : (
            <div className="sm:col-span-2 text-sm text-red-600 font-medium p-4 bg-red-50 rounded-lg border border-red-100">
              Hech qanday {labels.unitTypeLabel.toLowerCase()} mavjud emas. Avval "Mehmonxona E'loni" bo'limiga o'tib, {labels.unitTypeLabel.toLowerCase()} qo'shishingiz kerak.
            </div>
          )}

          <label
            htmlFor="r-listed"
            className="flex items-center gap-2 sm:col-span-2 cursor-pointer select-none"
          >
            <input
              id="r-listed"
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border)] accent-brand-700"
              {...form.register("isListed")}
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Sotuvda ko&apos;rsatilsin (mijozlarga ko&apos;rinadi)
            </span>
          </label>
        </div>

        {editing && (
          <RoomPhotosEditor room={editing} />
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
          {editing ? (
            <Button
              type="button"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={handleDelete}
              disabled={submitting}
            >
              O&apos;chirish
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {editing ? "Saqlash" : "Qo'shish"}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
