"use client";

import { useMemo, useState } from "react";
import { Button } from "../../../_components/ui/button";
import { Dialog } from "../../../_components/ui/dialog";
import { EmptyState } from "../../../_components/ui/empty-state";
import { useRooms, useUpdateRoom } from "../../../_hooks/use-rooms";
import { toast } from "sonner";
import { getPartnerLabels } from "../../../_lib/utils/partner-labels";
import { useAuthStore } from "../../../_stores/auth-store";

export function PublishRoomsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  
  const { allRooms: rooms } = useRooms();
  const updateRoom = useUpdateRoom();
  
  // Derive selected IDs from rooms whenever dialog opens — use key prop on parent
  // to reset, or track open state changes. Here we use a stable set that resets on open.
  const initialSet = useMemo(() => {
    const s = new Set<string>();
    if (open && rooms) {
      rooms
        .filter((r) => !r.number.startsWith("DELETED_"))
        .forEach((r) => { if (r.isListed) s.add(r.id); });
    }
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Intentionally only depends on `open` — resets when dialog opens

  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSet);
  const [prevOpen, setPrevOpen] = useState(open);
  const [isSaving, setIsSaving] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedIds(new Set(initialSet));
    }
  }


  const handleSave = async () => {
    if (!rooms) return;
    setIsSaving(true);
    try {
      const promises = rooms.map(room => {
        const shouldBeListed = selectedIds.has(room.id);
        if (room.isListed !== shouldBeListed) {
          return updateRoom.mutateAsync({
            id: room.id,
            values: { ...room, isListed: shouldBeListed },
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(promises);
      toast.success("E'longa chiqarish muvaffaqiyatli saqlandi");
      onClose();
    } catch {
      toast.error("Xatolik yuz berdi");
    } finally {
      setIsSaving(false);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      title={`${labels.unitPlural}ni e'longa chiqarish`}
      description={`Qaysi ${labels.unitPlural.toLowerCase()}ni turistlarga ko'rsatishni tanlang. Ro'yxatda faqat "Xonalar" bo'limida yaratilganlari chiqadi.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Bekor
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            Saqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {!rooms || rooms.filter(r => !r.number.startsWith("DELETED_")).length === 0 ? (
          <EmptyState
            title="Xonalar topilmadi"
            description={`Hali hech qanday ${labels.unitSingular.toLowerCase()} yaratilmagan. Avval "Xonalar" bo'limidan qo'shing.`}
          />
        ) : (
          rooms
            .filter((room) => !room.number.startsWith("DELETED_"))
            .map((room) => (
            <label
              key={room.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{labels.unitSingular} {room.number}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{room.roomTypeName}</span>
              </div>
              <input 
                type="checkbox"
                className="h-4 w-4"
                checked={selectedIds.has(room.id)}
                onChange={() => toggle(room.id)}
                aria-label={`${room.number} xonani e'longa chiqarish`}
              />
            </label>
          ))
        )}
      </div>
    </Dialog>
  );
}
