import type {
  Locale,
  BookingView,
  PaymentView,
  HotelListItem,
  HotelDetail,
  RoomTypeView,
  ProfileView,
  BonusView,
  BonusEntryView,
  FavoriteView,
  ReviewView,
  SupportMessageView,
  SupportTicketView,
} from "./types";

/* ───────────────────────── Locale Helpers ───────────────────────── */

type Localized = Partial<Record<Locale, string>> & Record<string, string>;

function pickLocale(value: Localized | undefined, locale: Locale): string {
  if (!value) return "";
  return value[locale] ?? value.uz ?? Object.values(value)[0] ?? "";
}

/* ───────────────────────── Booking Adapter ───────────────────────── */

interface RawPayment {
  status?: string;
  provider?: string;
  paymentUrl?: string;
}

interface RawBooking {
  id?: string;
  bookingNumber?: string;
  status?: string;
  type?: string;
  totalAmount?: number;
  createdAt?: string;
  payment?: RawPayment;
}

interface RawEnvelope extends RawBooking {
  booking?: RawBooking;
  payment?: RawPayment;
}

function toPaymentView(raw: RawPayment | undefined): PaymentView | undefined {
  if (!raw) return undefined;
  return {
    status: raw.status ?? "pending",
    provider: raw.provider ?? "",
    url: raw.paymentUrl,
  };
}

export function toBookingView(raw: RawEnvelope): BookingView {
  const booking: RawBooking = raw.booking ?? raw;
  const payment = raw.payment ?? booking.payment;

  return {
    id: booking.id ?? "",
    bookingNumber: booking.bookingNumber ?? "",
    status: booking.status ?? "PENDING",
    type: booking.type ?? "hotel",
    // `bookings.total_amount` so'mda saqlanadi (partner narx maydonlari —
    // `hotel_rooms.base_price`, `vehicles.price_per_day` — hech qanday
    // tiyinga aylantirmasdan to'g'ridan-to'g'ri yoziladi; production
    // ma'lumotlar bilan tasdiqlangan: masalan base_price=400000.00,
    // bookings.total_amount=980000.00 — bular aniq so'm, tiyin emas).
    // `tiyinToSum` shu yerda narxni 100x kichik ko'rsatib qo'yardi.
    totalSum: Number(booking.totalAmount ?? 0),
    currency: "UZS",
    createdAt: booking.createdAt ?? "",
    payment: toPaymentView(payment),
  };
}

/* ───────────────────────── Hotel Adapter ───────────────────────── */

interface RawCity {
  id: string;
  name: Localized;
}

interface RawRoom {
  id: string;
  name: Localized;
  basePrice: number;
  baseOccupancy?: number;
  maxAdults?: number;
  totalInventory?: number;
  available?: number;
}

interface RawHotel {
  id: string;
  slug: string;
  name: Localized;
  description?: Localized;
  address?: string;
  stars?: number;
  ratingAverage?: number;
  reviewsCount?: number;
  amenities?: string[];
  images?: string[];
  latitude?: number;
  longitude?: number;
  checkInTime?: string;
  checkOutTime?: string;
  minPrice?: number;
  city?: RawCity;
  rooms?: RawRoom[];
}

function toHotelBase(raw: RawHotel, locale: Locale): HotelListItem {
  return {
    id: raw.id,
    slug: raw.slug,
    name: pickLocale(raw.name, locale),
    cityName: pickLocale(raw.city?.name, locale),
    stars: raw.stars ?? 0,
    rating: raw.ratingAverage ?? 0,
    reviewsCount: raw.reviewsCount ?? 0,
    minPriceSum: Number(raw.minPrice ?? 0),
    imageUrl: raw.images?.[0],
    latitude: raw.latitude,
    longitude: raw.longitude,
  };
}

export function toHotelListItem(raw: RawHotel, locale: Locale): HotelListItem {
  return toHotelBase(raw, locale);
}

function toRoomView(raw: RawRoom, locale: Locale): RoomTypeView {
  return {
    id: raw.id,
    name: pickLocale(raw.name, locale),
    priceSum: Number(raw.basePrice ?? 0),
    capacity: raw.baseOccupancy ?? raw.maxAdults ?? 1,
    available: raw.available ?? raw.totalInventory ?? 0,
  };
}

export function toHotelDetail(raw: RawHotel, locale: Locale): HotelDetail {
  return {
    ...toHotelBase(raw, locale),
    description: pickLocale(raw.description, locale),
    address: raw.address ?? "",
    amenities: raw.amenities ?? [],
    images: raw.images ?? [],
    latitude: raw.latitude ?? 0,
    longitude: raw.longitude ?? 0,
    checkInTime: raw.checkInTime ?? "",
    checkOutTime: raw.checkOutTime ?? "",
    rooms: (raw.rooms ?? []).map((room) => toRoomView(room, locale)),
  };
}

/* ───────────────────────── User Adapter ───────────────────────── */

interface RawUser {
  id?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: string;
  preferredLanguage?: string;
  bonusBalance?: number;
  createdAt?: string;
}

export function toProfileView(raw: RawUser): ProfileView {
  const firstName = raw.firstName ?? "";
  const lastName = raw.lastName ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    id: raw.id ?? "",
    phone: raw.phone ?? "",
    firstName,
    lastName,
    fullName: fullName || (raw.phone ?? ""),
    email: raw.email ?? "",
    avatarUrl: (raw as any).avatarUrl || (raw as any).avatar_url,
    bonusBalanceSum: Number(raw.bonusBalance ?? 0),
    preferredLanguage: raw.preferredLanguage ?? "uz",
    status: raw.status ?? "active",
    createdAt: raw.createdAt ?? "",
  };
}

interface RawBonusEntry {
  id?: string;
  amount?: number;
  reason?: string;
  createdAt?: string;
}

interface RawBonuses {
  balance?: number;
  ledger?: RawBonusEntry[];
}

export function toBonusView(raw: RawBonuses): BonusView {
  return {
    balanceSum: Number(raw.balance ?? 0),
    currency: "UZS",
    entries: (raw.ledger ?? []).map(toBonusEntryView),
  };
}

function toBonusEntryView(raw: RawBonusEntry): BonusEntryView {
  return {
    id: raw.id ?? "",
    amountSum: Number(raw.amount ?? 0),
    reason: raw.reason ?? "",
    createdAt: raw.createdAt ?? "",
  };
}

interface RawFavorite {
  id?: string;
  targetType?: string;
  targetId?: string;
  createdAt?: string;
}

export function toFavoriteView(raw: RawFavorite): FavoriteView {
  return {
    id: raw.id ?? "",
    targetType: raw.targetType ?? "hotel",
    targetId: raw.targetId ?? "",
    createdAt: raw.createdAt ?? "",
  };
}

/* ───────────────────────── Review Adapter ───────────────────────── */

interface RawReview {
  id?: string;
  rating?: number;
  body?: string;
  status?: string;
  createdAt?: string;
  firstName?: string;
  lastName?: string;
  authorName?: string;
  avatarUrl?: string;
  photos?: unknown;
  isVerifiedGuest?: boolean;
  cleanliness?: number | null;
  staff?: number | null;
  location?: number | null;
  valueForMoney?: number | null;
}

function optionalRating(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function toReviewView(raw: RawReview): ReviewView {
  const authorName =
    raw.authorName ??
    [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim() ??
    undefined;
  const photos = Array.isArray(raw.photos)
    ? raw.photos.filter((photo): photo is string => typeof photo === "string")
    : undefined;

  return {
    id: raw.id ?? "",
    rating: typeof raw.rating === "number" ? raw.rating : 0,
    body: raw.body ?? "",
    createdAt: raw.createdAt ?? "",
    ...(authorName ? { authorName } : {}),
    ...(raw.avatarUrl ? { avatarUrl: raw.avatarUrl } : {}),
    ...(photos && photos.length > 0 ? { photos } : {}),
    ...(raw.isVerifiedGuest === true ? { isVerifiedGuest: true } : {}),
    ...(optionalRating(raw.cleanliness) !== undefined ? { cleanliness: optionalRating(raw.cleanliness) } : {}),
    ...(optionalRating(raw.staff) !== undefined ? { staff: optionalRating(raw.staff) } : {}),
    ...(optionalRating(raw.location) !== undefined ? { location: optionalRating(raw.location) } : {}),
    ...(optionalRating(raw.valueForMoney) !== undefined ? { valueForMoney: optionalRating(raw.valueForMoney) } : {}),
  };
}

/* ───────────────────────── Support Adapter ───────────────────────── */

interface RawSupportMessage {
  id?: string;
  ticketId?: string;
  senderType?: string;
  senderId?: string;
  body?: string;
  createdAt?: string;
}

interface RawSupportTicket {
  id?: string;
  subject?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: RawSupportMessage[];
}

export function toSupportMessageView(
  raw: RawSupportMessage,
): SupportMessageView {
  return {
    id: raw.id ?? "",
    ticketId: raw.ticketId ?? "",
    senderType: raw.senderType ?? "",
    senderId: raw.senderId ?? "",
    body: raw.body ?? "",
    createdAt: raw.createdAt ?? "",
  };
}

export function toSupportTicketView(raw: RawSupportTicket): SupportTicketView {
  return {
    id: raw.id ?? "",
    subject: raw.subject ?? "",
    priority: raw.priority ?? "medium",
    status: raw.status ?? "open",
    createdAt: raw.createdAt ?? "",
    updatedAt: raw.updatedAt ?? "",
    messages: (raw.messages ?? []).map(toSupportMessageView),
  };
}
