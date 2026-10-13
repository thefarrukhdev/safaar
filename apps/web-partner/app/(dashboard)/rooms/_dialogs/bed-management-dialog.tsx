"use client";

import { BedSingle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { RoomStatusBadge } from "@/components/domain/room-status-badge";
import { useDataStore } from "@/stores/data-store";
import { useCreateBed, useDeleteBed, useUpdateBed } from "@/hooks/use-beds";
import { RoomStatus, type Room } from "@/lib/domain/types";

interface Props {
  open: boolean;
  onClose: () => void;
  room: Room | null;
}

/** Dormitory xonasi ichidagi alohida yotoqlarni boshqarish (faqat hostel). */
export function BedManagementDialog({ open, onClose, room }: Props) {
  const beds = useDataStore((s) => s.beds);
  const createBed = useCreateBed();
  const updateBed = useUpdateBed();
  const deleteBed = useDeleteBed();

  const roomBeds = room
    ? beds.filter((b) => b.roomId === room.id).sort((a, b) => a.label.localeCompare(b.label))
    : [];

  const handleAdd = async () => {
    if (!room) return;
    try {
      await createBed.mutateAsync({
        roomId: room.id,
        label: `${roomBeds.length + 1}-o'rin`,
      });
      toast.success("Yotoq qo'shildi");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Qo'shib bo'lmadi",
      );
    }
  };

  const handleToggleListed = async (bedId: string, isListed: boolean) => {
    try {
      await updateBed.mutateAsync({ id: bedId, values: { isListed: !isListed } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "O'zgartirib bo'lmadi",
      );
    }
  };

  const handleDelete = async (bedId: string, label: string) => {
    if (!confirm(`Rostdan ham ${label} ni o'chirmoqchimisiz?`)) return;
    try {
      await deleteBed.mutateAsync(bedId);
      toast.success(`${label} o'chirildi`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "O'chirib bo'lmadi",
      );
    }
  };

  const submitting =
    createBed.isPending || updateBed.isPending || deleteBed.isPending;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={room ? `Xona ${room.number} — Yotoqlar` : "Yotoqlar"}
      description="Har bir yotoq mustaqil band qilinadi va tizimda alohida kuzatiladi."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Yopish
          </Button>
          <Button onClick={handleAdd} disabled={submitting}>
            <Plus className="h-4 w-4" aria-hidden />
            Yotoq qo'shish
          </Button>
        </>
      }
    >
      {roomBeds.length === 0 ? (
        <EmptyState
          icon={<BedSingle className="h-10 w-10" aria-hidden />}
          title="Hozircha yotoq yo'q"
          description="Bu dormitory xonaga birinchi yotoqni qo'shing."
          action={
            <Button onClick={handleAdd} disabled={submitting}>
              <Plus className="h-4 w-4" aria-hidden />
              Birinchi yotoqni qo'shish
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {roomBeds.map((bed) => (
            <div
              key={bed.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <BedSingle className="h-4 w-4 text-zinc-400" aria-hidden />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{bed.label}</span>
                  <RoomStatusBadge status={bed.status} className="mt-0.5" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-[var(--border)] accent-brand-700"
                    checked={bed.isListed}
                    disabled={submitting}
                    onChange={() => handleToggleListed(bed.id, bed.isListed)}
                  />
                  Sotuvda
                </label>
                <button
                  type="button"
                  onClick={() => handleDelete(bed.id, bed.label)}
                  disabled={submitting || bed.status === RoomStatus.OCCUPIED}
                  aria-label={`${bed.label} ni o'chirish`}
                  className="rounded-md p-1.5 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
