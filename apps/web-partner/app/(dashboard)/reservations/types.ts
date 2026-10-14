import { BookingStatus } from "@safaar/types";
import type { ReservationUiStatus } from "../../_lib/domain/types";

export type FilterKey = "all" | ReservationUiStatus;

export const RESERVATION_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: BookingStatus.PENDING, label: "Yangi" },
  { key: BookingStatus.CONFIRMED, label: "Tasdiqlangan" },
  { key: "IN_HOUSE", label: "Yashayapti" },
  { key: BookingStatus.COMPLETED, label: "Yakunlangan" },
  { key: BookingStatus.CANCELLED, label: "Bekor qilingan" },
];

export interface ReservationStatsData {
  active: number;
  arrivalsToday: number;
  pending: number;
  unpaid: number;
  totalRevenue: number;
}

export type ViewMode = "table" | "card";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export function parseStatusParam(value: string | null): FilterKey {
  if (!value) return "all";
  const upper = value.trim().toUpperCase();
  if (upper === "NEW" || upper === "YANGI") return BookingStatus.PENDING;
  if (upper === "ALL" || upper === "HAMMASI") return "all";
  if (upper === "CANCELED") return BookingStatus.CANCELLED;
  const found = RESERVATION_FILTERS.find((f) => f.key.toUpperCase() === upper);
  return found ? found.key : "all";
}
