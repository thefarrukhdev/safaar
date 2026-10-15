import { BookingStatus } from '@safaar/types';
import { addDays } from '../utils/date';
import {
  ReservationSource,
  type ReservationView,
  type RoomType,
} from './types';

/**
 * Hisobotlar uchun haqiqiy bronlardan hisoblanadigan statistika.
 */

function isActive(r: ReservationView): boolean {
  return (
    r.status !== BookingStatus.CANCELLED && r.status !== BookingStatus.EXPIRED
  );
}

export interface DailyStat {
  date: string;
  /** Shu kunga to'g'ri keladigan kechalar bo'yicha proratsiya qilingan daromad. */
  revenue: number;
  /** Shu kunni qamrab olgan faol bronlar soni. */
  bookings: number;
  /** Shu kunda band bo'lgan birliklar (xona yoki yotoq) soni. */
  occupiedUnits: number;
}

/** Oxirgi `days` kunlik kunlik statistika (bugundan orqaga). */
export function buildDailyStats(
  reservations: ReservationView[],
  todayIso: string,
  days: number,
): DailyStat[] {
  const active = reservations.filter(isActive);
  const result: DailyStat[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dateIso = addDays(todayIso, -i);
    let revenue = 0;
    let bookings = 0;

    for (const r of active) {
      const matches =
        r.checkIn === r.checkOut
          ? dateIso === r.checkIn
          : dateIso >= r.checkIn && dateIso < r.checkOut;
      if (matches) {
        revenue += r.nights > 0 ? r.totalPrice / r.nights : 0;
        bookings += 1;
      }
    }

    result.push({
      date: dateIso,
      revenue: Math.round(revenue),
      bookings,
      occupiedUnits: bookings,
    });
  }

  return result;
}

/** Xona/dorm turi bo'yicha bronlar va daromad — haqiqiy ma'lumotdan. */
export function buildUnitTypeDistribution(
  reservations: ReservationView[],
  roomTypes: RoomType[],
): Array<{ id: string; name: string; bookings: number; revenue: number }> {
  const map = new Map<
    string,
    { id: string; name: string; bookings: number; revenue: number }
  >();

  for (const r of reservations) {
    if (!isActive(r)) continue;
    const roomType = roomTypes.find((rt) => rt.id === r.roomTypeId);
    const name = roomType?.name ?? r.roomTypeName;
    const entry = map.get(r.roomTypeId) ?? { id: r.roomTypeId, name, bookings: 0, revenue: 0 };
    entry.bookings += 1;
    entry.revenue += r.totalPrice;
    map.set(r.roomTypeId, entry);
  }

  return Array.from(map.values());
}

const SOURCE_LABEL: Record<ReservationSource, string> = {
  [ReservationSource.UZBRON]: 'Safaar',
  [ReservationSource.WALK_IN]: 'Walk-in',
  [ReservationSource.PHONE]: 'Telefon',
  [ReservationSource.BOOKING_COM]: 'Booking.com',
};

/** Bron manbai bo'yicha taqsimot — haqiqiy ma'lumotdan. */
export function buildSourceDistribution(
  reservations: ReservationView[],
): Array<{ name: string; value: number }> {
  const counts = new Map<ReservationSource, number>();
  for (const r of reservations) {
    if (!isActive(r)) continue;
    counts.set(r.source, (counts.get(r.source) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([source, value]) => ({
    name: SOURCE_LABEL[source] ?? source,
    value,
  }));
}

/** Dacha uchun: davrdagi band/bo'sh kunlar soddalashtirilgan xulosasi. */
export function buildDachaAvailabilitySummary(dailyStats: DailyStat[]): {
  bookedNights: number;
  totalNights: number;
} {
  const bookedNights = dailyStats.filter((d) => d.occupiedUnits > 0).length;
  return { bookedNights, totalNights: dailyStats.length };
}
