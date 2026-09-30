import type { BookingStatus } from "@safaar/types";
import { ListingPhoto } from "./listing";

/**
 * Mehmonxona staff paneli uchun domain turlari.
 *
 * `@safaar/types`'da hozir bo'lmagan kontseptlar shu yerda yashaydi.
 * Backend tayyor bo'lganda bu turlar `@safaar/types`'ga ko'chiriladi
 * (backend dev'dan so'rab).
 */

/** Xona housekeeping holati. */
export enum RoomStatus {
  /** Toza va bo'sh — kelish uchun tayyor */
  VACANT_CLEAN = "VACANT_CLEAN",
  /** Iflos va bo'sh — tozalash kerak */
  VACANT_DIRTY = "VACANT_DIRTY",
  /** Band — mehmon ichida */
  OCCUPIED = "OCCUPIED",
  /** Ta'mirda */
  OUT_OF_SERVICE = "OUT_OF_SERVICE",
  /** Bloklangan (egasi tomonidan band, sotuvga qo'yilmagan) */
  BLOCKED = "BLOCKED",
}

/** Bron manbai. */
export enum ReservationSource {
  UZBRON = "UZBRON",
  WALK_IN = "WALK_IN",
  PHONE = "PHONE",
  BOOKING_COM = "BOOKING_COM",
}

/** UI status — `BookingStatus`'ga `IN_HOUSE` qo'shilgan. */
export type ReservationUiStatus = BookingStatus | "IN_HOUSE";

/** Xona turi (Standart, Lyuks, Suite...). */
export interface RoomType {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  bedType?: string;
  sizeSqm?: number;
  basePrice: number;
  capacity: number;
  amenities: string[];
}

/** Mehmonxonadagi real xona (102, 201...). */
export interface Room {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomTypeName: string;
  /** Turistlarga sotuvda ko'rinadimi. */
  isListed: boolean;
  photos: ListingPhoto[];
  /** Agar xona alohida narxda e'lon qilinsa. */
  nightlyPrice?: number;
  status: RoomStatus;
  /** Hozir band bo'lsa — joriy bronning qisqa ma'lumoti */
  occupant?: {
    guestName: string;
    reservationId: string;
    checkOut: string;
  };
}

/** Hostel dormitory ichidagi alohida yotoq. */
export interface Bed {
  id: string;
  /** Egasi bo'lgan dormitory Room. */
  roomId: string;
  /** "1-o'rin", "2-o'rin"... */
  label: string;
  status: RoomStatus;
  isListed: boolean;
  /** Ixtiyoriy — yo'q bo'lsa Room/RoomType narxi ishlatiladi. */
  nightlyPrice?: number;
  occupant?: {
    guestName: string;
    reservationId: string;
    checkOut: string;
  };
}

/** Bron — staff ko'rinishida (mijoz va to'lov ma'lumotlari bilan). */
export interface ReservationView {
  id: string;
  status: ReservationUiStatus;
  source: ReservationSource;
  guest: {
    id: string;
    fullName: string;
    phone: string;
    email?: string;
    document?: string;
  };
  roomTypeId: string;
  roomTypeName: string;
  /** Tayinlangan real xona raqami (CONFIRMED'dan keyin) */
  roomNumber?: string;
  /** Faqat hostel: tayinlangan yotoq (Bed.id). */
  bedId?: string;
  /** Faqat restoran: bron vaqt-sloti ("HH:MM"). */
  slotTime?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  totalPrice: number;
  paidAmount: number;
  specialRequests?: string;
  internalNote?: string;
  createdAt: string;
}

/** Mijoz profili (history bilan). */
export interface GuestProfile {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  totalStays: number;
  totalSpent: number;
  lastStay?: string;
  isVip: boolean;
  tags: string[];
}

/** Front Desk dashboard KPI'lari. */
export interface FrontDeskStats {
  occupancyPercent: number;
  totalRooms: number;
  occupiedRooms: number;
  arrivalsToday: number;
  departuresToday: number;
  pendingReservations: number;
  monthRevenue: number;
}
