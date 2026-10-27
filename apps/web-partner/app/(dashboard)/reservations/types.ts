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

export function getReservationFilters(partnerType?: string | null): { key: FilterKey; label: string }[] {
  const pt = (partnerType ?? "").toLowerCase();
  const isRest = pt === "restaurant";
  const isVehicle = pt === "bus" || pt === "rent_car";
  const isDacha = pt === "dacha";
  const inHouseLabel = isRest
    ? "Mijoz kelgan (Amalda)"
    : isVehicle
      ? "Ijarada (Mijozda)"
      : isDacha
        ? "Dachada (Band)"
        : "Yashayapti";

  return [
    { key: "all", label: "Hammasi" },
    { key: BookingStatus.PENDING, label: "Yangi" },
    { key: BookingStatus.CONFIRMED, label: "Tasdiqlangan" },
    { key: "IN_HOUSE", label: inHouseLabel },
    { key: BookingStatus.COMPLETED, label: "Yakunlangan" },
    { key: BookingStatus.CANCELLED, label: "Bekor qilingan" },
  ];
}

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
  const upper = value.trim().toUpperCase().replace(/[-_ ]+/g, "_");
  if (upper === "NEW" || upper === "YANGI" || upper === "PENDING") return BookingStatus.PENDING;
  if (upper === "ALL" || upper === "HAMMASI" || upper === "BARCHASI") return "all";
  if (upper === "CONFIRMED" || upper === "TASDIQLANGAN") return BookingStatus.CONFIRMED;
  if (upper === "IN_HOUSE" || upper === "YASHAYAPTI" || upper === "JOYLASHTIRILGAN") return "IN_HOUSE";
  if (upper === "COMPLETED" || upper === "YAKUNLANGAN") return BookingStatus.COMPLETED;
  if (upper === "CANCELLED" || upper === "CANCELED" || upper === "BEKOR" || upper === "BEKOR_QILINGAN") return BookingStatus.CANCELLED;
  const found = RESERVATION_FILTERS.find((f) => f.key.toUpperCase() === upper);
  return found ? found.key : "all";
}
