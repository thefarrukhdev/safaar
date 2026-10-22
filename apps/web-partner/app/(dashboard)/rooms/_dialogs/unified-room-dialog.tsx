"use client";

import { type Room, type RoomType } from "../../../_lib/domain/types";
import { AddRoomDialog } from "./add-room-dialog";
import { EditRoomDialog } from "./edit-room-dialog";
import { RoomTypeDialog } from "./room-type-dialog";

export type UnifiedRoomDialogMode = "room" | "type-only";

export interface UnifiedRoomDialogProps {
  open: boolean;
  onClose: () => void;
  mode?: UnifiedRoomDialogMode;
  editing?: RoomType | null;
  editingPhysicalRoom?: Room | null;
  defaultFloor?: number;
}

/**
 * Unified Room Dialog:
 * Domen modeliga muvofiq to'g'ri dialogga yo'naltiruvchi birlashtirilgan fasad.
 * - `type-only` yoki RoomType tahrirlash -> `RoomTypeDialog`
 * - Fizik xonani tahrirlash (`editingPhysicalRoom`) -> `EditRoomDialog`
 * - Yangi xona qo'shish (yakka yoki ommaviy) -> `AddRoomDialog`
 */
export function UnifiedRoomDialog({
  open,
  onClose,
  mode = "room",
  editing,
  editingPhysicalRoom,
  defaultFloor,
}: UnifiedRoomDialogProps) {
  if (editingPhysicalRoom) {
    return (
      <EditRoomDialog
        open={open}
        onClose={onClose}
        room={editingPhysicalRoom}
      />
    );
  }

  if (mode === "type-only" || (editing && !editingPhysicalRoom)) {
    return (
      <RoomTypeDialog
        open={open}
        onClose={onClose}
        editing={editing}
      />
    );
  }

  return (
    <AddRoomDialog
      open={open}
      onClose={onClose}
      defaultFloor={defaultFloor}
      defaultRoomTypeId={editing?.id}
    />
  );
}

export { AddRoomDialog, EditRoomDialog, RoomTypeDialog };
