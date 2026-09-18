import type { BookingStatus } from '@safaar/types';

/* ────────────────────────────────────────────
   Admin User
   ──────────────────────────────────────────── */

export type AdminRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MODERATOR'
  | 'FINANCE_ADMIN'
  | 'CONTENT_ADMIN'
  | 'SUPPORT_ADMIN';

export interface AdminUser {
  id: string;
  fullName: string;
  name?: string;
  email: string;
  role: AdminRole;
  phone: string;
  avatar?: string;
  lastLogin: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminListing {
  id: string;
  partnerId: string;
  companyName: string;
  hotelName: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  stars: number;
  featured?: boolean;
  /** Faqat `featured=true` bo'lganlar orasidagi tartib — `featured`dan
   * ALOHIDA tushuncha (bir hotel featured bo'lib, hali tartib belgilanmagan
   * bo'lishi mumkin). `null` = hali tartib berilmagan. */
  featuredOrder?: number | null;
  photos?: string[];
  description?: string;
  amenities?: string[];
  rules?: {
    checkInTime?: string;
    checkOutTime?: string;
    childrenAllowed?: boolean;
    petsAllowed?: boolean;
    smokingAllowed?: boolean;
    cancellationPolicy?: string;
  };
  roomsCount?: number;
  roomTypes?: AdminRoomType[];
  type?: string;
  status: 'draft' | 'under_review' | 'published' | 'rejected';
  submittedAt: string;
  completeness?: {
    isPublishable: boolean;
    missingFields: string[];
  };
}

/* ────────────────────────────────────────────
   Rooms / Availability (2026-09-14 SAFAAR admin gap closure)
   backend: GET /admin/hotels/:id already returns room_types[].rooms[]
   (admin.service.ts groupAdminRoomTypes) — reused as-is, no new endpoint
   needed just to list a hotel's rooms.
   ──────────────────────────────────────────── */

export interface AdminRoom {
  id: string;
  code: string;
  name: string;
  totalInventory: number;
  basePrice: number;
  status: string;
}

export interface AdminRoomType {
  id: string;
  code: string;
  name: string;
  rooms: AdminRoom[];
}

export type AvailabilityDayStatus =
  | 'available'
  | 'booked'
  | 'blocked'
  | 'partially_occupied';

export interface AvailabilityDay {
  date: string;
  totalCount: number;
  bookedCount: number;
  blocked: boolean;
  status: AvailabilityDayStatus;
  sellableCount: number;
}

export interface RoomAvailability {
  roomId: string;
  hotelId: string;
  totalInventory: number;
  days: AvailabilityDay[];
}

/* ────────────────────────────────────────────
   Reviews (2026-09-14 SAFAAR admin gap closure)
   backend: reviews table + src/reviews/ (customer-facing, pre-existing);
   admin list/moderate added in admin.service.ts (reviewsList/reviewModerate).
   ──────────────────────────────────────────── */

export type AdminReviewStatus = 'published' | 'hidden' | 'pending_review';

/* ────────────────────────────────────────────
   Generic CMS entry (2026-09-14 gap closure — Translations/SEO)
   backend: cms_entries (title/body Json, metadata Json) via the EXISTING
   generic GET/PATCH /admin/cms/:resource[/:id] (admin.service.ts
   cmsList/cmsOne/cmsUpdate) — reused as-is, no new backend model.
   The existing CmsBanner/CmsArticle types flatten title to one locale;
   this one keeps the full {uz,ru,en} object for language-tabbed editing.
   ──────────────────────────────────────────── */

export const CMS_RESOURCES = [
  'banners',
  'offers',
  'news',
  'pages',
  'templates',
  'broadcasts',
  'destinations',
] as const;
export type CmsResource = (typeof CMS_RESOURCES)[number];

export interface CmsEntrySeo {
  metaTitle?: string;
  metaDescription?: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface CmsEntry {
  id: string;
  type: string;
  slug: string | null;
  title: Record<string, string>;
  body: Record<string, string>;
  status: string;
  metadata: Record<string, unknown>;
  seo: CmsEntrySeo;
  updatedAt: string;
}

export interface AdminReview {
  id: string;
  userId: string;
  userName: string;
  bookingId: string | null;
  targetType: string;
  targetId: string;
  targetName: string;
  rating: number;
  body: string;
  photos: string[];
  status: AdminReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRefund {
  id: string;
  bookingId: string;
  userId?: string;
  status: 'requested' | 'approved' | 'rejected' | 'processing' | 'refunded' | 'failed';
  requestedAmount: number;
  approvedAmount?: number;
  currency: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

/* ────────────────────────────────────────────
   Dashboard
   ──────────────────────────────────────────── */

export interface DashboardStat {
  label: string;
  value: string;
  change?: number; // +12% yoki -5%
  icon: string;
  color: string;
}

export interface BookingTrend {
  date: string;
  hotels: number;
  buses: number;
}

export interface RevenueData {
  month: string;
  commission: number;
  partnerPayment: number;
}

export interface ServiceDistribution {
  name: string;
  value: number;
  color: string;
}

export interface ActivityLogItem {
  id: string;
  type:
    | 'user_registered'
    | 'partner_request'
    | 'booking_created'
    | 'booking_cancelled'
    | 'payment_request'
    | 'complaint';
  message: string;
  timestamp: string;
  icon: string;
}

export interface QuickAction {
  label: string;
  count: number;
  color: string;
  href: string;
}

/* ────────────────────────────────────────────
   Users
   ──────────────────────────────────────────── */

export type UserStatus = 'active' | 'blocked' | 'unverified';

export interface AdminManagedUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  status: UserStatus;
  bookingsCount: number;
  totalSpent: number;
  bonusBalance: number;
  lastLogin: string;
  createdAt: string;
}

export interface UserBookingHistory {
  id: string;
  serviceType: 'hotel' | 'bus';
  serviceName: string;
  date: string;
  amount: number;
  status: BookingStatus;
}

export interface UserPayment {
  id: string;
  method: 'click' | 'payme' | 'uzcard' | 'humo';
  amount: number;
  date: string;
  type: 'payment' | 'refund';
}

/* ────────────────────────────────────────────
   Partners
   ──────────────────────────────────────────── */

export type PartnerType =
  | 'hotel'
  | 'bus'
  | 'hostel'
  | 'guesthouse'
  | 'motel'
  | 'dacha'
  | 'restaurant';
export type PartnerRequestStatus =
  | 'new'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'submitted';
export type PartnerStatus =
  | 'active'
  | 'suspended'
  | 'blocked'
  | 'reviewing'
  | 'rejected';

export interface Partner {
  id: string;
  companyName: string;
  type: PartnerType;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  commissionPercent: number;
  rating: number;
  totalBookings: number;
  totalRevenue: number;
  status: PartnerStatus;
  bankName?: string;
  bankAccount?: string;
  bankMfo?: string;
  createdAt: string;
}

export interface PartnerRequest {
  id: string;
  companyName: string;
  type: PartnerType;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  documents: PartnerDocument[];
  note?: string;
  status: PartnerRequestStatus;
  adminNote?: string;
  createdAt: string;
}

export interface PartnerDocument {
  name: string;
  type: 'license' | 'tax_certificate' | 'passport';
  url: string;
}

export interface PartnerLedgerEntry {
  id: string;
  partnerId: string;
  type: 'booking_revenue' | 'commission_fee' | 'withdrawal' | 'adjustment' | 'refund';
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string;
  createdAt: string;
}

export interface DeveloperApiKey {
  id: string;
  partnerId: string;
  partnerName: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface DeveloperWebhook {
  id: string;
  partnerId: string;
  partnerName: string;
  url: string;
  events: string[];
  isActive: boolean;
  failedDeliveries: number;
  createdAt: string;
}

/* ────────────────────────────────────────────
   Bookings (Admin view)
   ──────────────────────────────────────────── */

export type PaymentMethod = 'click' | 'payme' | 'uzcard' | 'humo';

/** Turar-joy turi — hotel/motel/hostel/dacha bir xil "kecha-oralig'i" bron
 * modelidan foydalanadi, shuning uchun bitta jadvalda birlashtirilgan,
 * faqat shu maydon orqali farqlanadi. */
export type AccommodationPartnerType = "hotel" | "motel" | "hostel" | "dacha" | "guesthouse";

export interface AdminHotelBooking {
  id: string;
  partnerId?: string;
  customerName: string;
  customerPhone: string;
  hotelName: string;
  partnerType: AccommodationPartnerType;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  amount: number;
  paymentMethod: PaymentMethod;
  commission: number;
  status: BookingStatus;
  city: string;
  createdAt: string;
}

export interface AdminBusBooking {
  id: string;
  partnerId?: string;
  customerName: string;
  customerPhone: string;
  companyName: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  paymentMethod: PaymentMethod;
  commission: number;
  status: BookingStatus;
  createdAt: string;
}

export interface AdminRestaurantBooking {
  id: string;
  customerName: string;
  customerPhone: string;
  restaurantName: string;
  tableType: string;
  date: string;
  slotTime: string;
  guests: number;
  amount: number;
  paymentMethod: PaymentMethod;
  commission: number;
  status: BookingStatus;
  createdAt: string;
}

export interface BookingStatusHistory {
  status: string;
  timestamp: string;
  note?: string;
}

export interface BookingDetail {
  id: string;
  serviceType: 'hotel' | 'bus' | 'restaurant';
  status: BookingStatus;
  createdAt: string;

  // Mijoz
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerId: string;

  // Mehmonxona / Restoran (stol turi va vaqt-slot restoran uchun ishlatiladi)
  hotelName?: string;
  hotelAddress?: string;
  roomType?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  guests?: number;
  /** Faqat restoran: bron vaqt-sloti ("HH:MM"). */
  slotTime?: string;

  // Avtobus
  companyName?: string;
  route?: string;
  departureDate?: string;
  departureTime?: string;
  seatNumber?: string;

  // To'lov
  paymentMethod: PaymentMethod;
  totalAmount: number;
  commission: number;
  partnerAmount: number;
  transactionId: string;
  paidAt: string;

  // Tarix
  statusHistory: BookingStatusHistory[];
}

/* ────────────────────────────────────────────
   Finance
   ──────────────────────────────────────────── */

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface WithdrawalRequest {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  requestDate: string;
  status: WithdrawalStatus;
  bankAccount: string;
}

export interface FinanceReport {
  id: string;
  title: string;
  period: string;
  totalRevenue: number;
  totalCommission: number;
  dateGenerated: string;
}

export interface AdminPaymentTransaction {
  id: string;
  bookingId: string;
  customerName: string;
  amount: number;
  provider: 'click' | 'payme' | 'uzcard' | 'humo' | 'stripe';
  status: 'pending' | 'success' | 'failed' | 'refunded';
  providerTransactionId?: string;
  createdAt: string;
}

export interface AdminRefundTransaction {
  id: string;
  paymentId: string;
  bookingId: string;
  customerName: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed' | 'completed';
  createdAt: string;
}

export interface FinanceOverviewData {
  totalRevenue: number;
  totalCommission: number;
  pendingWithdrawals: number;
  paidWithdrawals: number;
  totalRefunds: number;
}

export interface ProviderReconciliation {
  provider: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  status: 'matched' | 'mismatched';
  lastSyncedAt: string;
}

export interface FinanceDocument {
  id: string;
  type: 'invoice' | 'tax_report' | 'act';
  title: string;
  partnerName?: string;
  period: string;
  url: string;
  status: 'generated' | 'failed' | 'pending';
  createdAt: string;
}

/* ────────────────────────────────────────────
   CMS
   ──────────────────────────────────────────── */

export interface CmsBanner {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  isActive: boolean;
  order: number;
}

export interface CmsArticle {
  id: string;
  title: string;
  type: 'news' | 'offer' | 'page';
  slug: string;
  status: 'published' | 'draft';
  publishedAt: string;
  metadata?: any;
}

export interface CmsDestination {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  isActive: boolean;
  order: number;
}

/* ────────────────────────────────────────────
   Catalog
   ──────────────────────────────────────────── */

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  targetType: 'all' | 'users' | 'partners';
  status: 'draft' | 'sending' | 'sent' | 'failed';
  sentCount: number;
  createdAt: string;
}

export interface CatalogRegion {
  id: string;
  name: string;
  hotelsCount: number;
  isActive: boolean;
}

export interface CatalogAmenity {
  id: string;
  code: string;
  name: string;
  icon: string;
  type: 'hotel' | 'room' | 'dacha' | 'restaurant' | 'transport' | 'other';
  isActive: boolean;
}

/* ────────────────────────────────────────────
   Promos
   ──────────────────────────────────────────── */

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  usageLimit: number;
  usedCount: number;
  validUntil: string;
  isActive: boolean;
}

/* ────────────────────────────────────────────
   Support
   ──────────────────────────────────────────── */

export type TicketStatus = 'open' | 'in_progress' | 'closed';

// develop (ce07fc27) independently added a shallower AdminReview here
// (hotelId/hotelName/comment/status: 'published'|'hidden'|'spam') plus
// AdminTranslation and AdminSeo, all backing mocked-only AdminApi methods
// ("MOCKED - BACKEND ENDPOINT YETISHMAYDI"). Dropped as part of the merge
// resolution in favor of the real AdminReview (line ~155) and the
// CmsEntry/CmsEntrySeo-based translations/SEO model, both backed by the
// actual /admin/reviews and /admin/cms/:resource routes verified live
// against the QA backend this session.

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderName: string;
  senderRole: 'admin' | 'customer';
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  customerName: string;
  customerType: 'user' | 'partner';
  contactName?: string;
  businessName?: string;
  hotelName?: string;
  companyName?: string;
  taxId?: string;
  partnerId?: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  createdAt: string;
}

/* ────────────────────────────────────────────
   Sidebar
   ──────────────────────────────────────────── */

export interface SidebarMenuItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  children?: SidebarMenuItem[];
}
