/**
 * Front uchun "view-model" turlari.
 */

export type Locale = "uz" | "ru" | "en";

export interface CityOption {
  id: string;
  name: string;
}

export interface AmenityOption {
  id: string;
  name: string;
}

export interface HotelListItem {
  id: string;
  slug: string;
  name: string;
  cityName: string;
  stars: number;
  rating: number;
  reviewsCount: number;
  minPriceSum: number;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
}

export interface RoomTypeView {
  id: string;
  name: string;
  priceSum: number;
  capacity: number;
  available: number;
}

export interface HotelDetail extends HotelListItem {
  description: string;
  address: string;
  amenities: string[];
  images: string[];
  latitude: number;
  longitude: number;
  checkInTime: string;
  checkOutTime: string;
  rooms: RoomTypeView[];
}

export interface PaymentView {
  status: string;
  provider: string;
  url?: string;
}

export interface BookingView {
  id: string;
  bookingNumber: string;
  status: string;
  type: string;
  totalSum: number;
  currency: "UZS";
  createdAt: string;
  payment?: PaymentView;
}

export interface ProfileView {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  bonusBalanceSum: number;
  preferredLanguage: string;
  status: string;
  createdAt: string;
}

export interface BonusView {
  balanceSum: number;
  currency: "UZS";
  entries: BonusEntryView[];
}

export interface BonusEntryView {
  id: string;
  amountSum: number;
  reason: string;
  createdAt: string;
}

export interface FavoriteView {
  id: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export interface ReviewView {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName?: string;
  avatarUrl?: string;
  photos?: string[];
  isVerifiedGuest?: boolean;
  cleanliness?: number;
  staff?: number;
  location?: number;
  valueForMoney?: number;
}

export interface SupportTicketView {
  id: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessageView[];
}

export interface SupportMessageView {
  id: string;
  ticketId: string;
  senderType: "user" | "partner" | "admin" | string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface PromoView {
  code: string;
  discountType: "percent" | "fixed" | string;
  discountValue: number;
  validUntil: string;
}

export interface CmsPageView {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: string;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
}
