import { RoomStatus, type Room } from "../../_lib/domain/types";

export type RoomViewMode = "grid" | "table";

export interface RoomMetrics {
  total: number;
  clean: number;
  dirty: number;
  occupied: number;
  outOfService: number;
  blocked: number;
  occupancyRate: number;
}

export interface FloorGroup {
  floor: number;
  rooms: Room[];
  total: number;
  cleanCount: number;
  occupiedCount: number;
}

export type RoomSortOption = "number" | "status";

export interface BulkStatusOption {
  label: string;
  value: RoomStatus;
  color: string;
}

export const ROOM_STATUS_OPTIONS: BulkStatusOption[] = [
  { label: "Toza (Vacant Clean)", value: RoomStatus.VACANT_CLEAN, color: "#10b981" },
  { label: "Nopok (Vacant Dirty)", value: RoomStatus.VACANT_DIRTY, color: "#f59e0b" },
  { label: "Band (Occupied)", value: RoomStatus.OCCUPIED, color: "#3b82f6" },
  { label: "Ta'mirda (Out of Service)", value: RoomStatus.OUT_OF_SERVICE, color: "#ef4444" },
];
