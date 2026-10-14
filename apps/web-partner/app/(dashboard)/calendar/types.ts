import type { ReservationView } from "../../_lib/domain/types";

export type ViewMode = 7 | 14 | 30;

/** Kalendar qatori — mehmonxona uchun bitta xona, hostel uchun bitta yotoq, transport uchun avtomobil. */
export interface CalendarRow {
  key: string;
  roomTypeId: string;
  primaryLabel: string;
  secondaryLabel: string;
  isListed: boolean;
  nightlyPrice?: number;
  roomNumber: string;
  floor?: number;
  bedId?: string;
  isOccupiedToday?: boolean;
  /** Bu qatorga tegishli bronni aniqlash funksiyasi */
  matches: (r: ReservationView) => boolean;
}

/** Grid ustida ko'rsatiladigan bron chizig'i */
export interface CalendarRowBar {
  reservation: ReservationView;
  startCol: number;
  spanCols: number;
  truncatedStart: boolean;
  truncatedEnd: boolean;
}

/** Ko'rsatilayotgan davr bo'yicha hisoblangan statistikalar */
export interface CalendarPeriodStats {
  bookings: number;
  total: number;
  paid: number;
  balance: number;
  listedRows: number;
  totalRows: number;
  occupancyRate: number;
}

/** Filtrlar holati */
export interface CalendarFiltersState {
  viewMode: ViewMode;
  startOffset: number;
  typeFilter: string;
  statusFilter: "all" | "occupied" | "vacant";
  searchQuery: string;
}
