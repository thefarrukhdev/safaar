import {
  AdminManagedUser,
  AdminListing,
  Partner,
  AdminHotelBooking,
  AdminBusBooking,
  AdminRestaurantBooking,
  PartnerRequest,
  CatalogAmenity,
  CatalogRegion,
  CmsArticle,
  CmsBanner,
  FinanceReport,
  PromoCode,
  SupportTicket,
  TicketMessage,
  WithdrawalRequest,
  BookingDetail,
  ActivityLogItem,
  AdminUser,
  AdminRole,
  BroadcastNotification,
  AdminPaymentTransaction,
  AdminRefundTransaction,
  FinanceOverviewData,
  ProviderReconciliation,
  FinanceDocument,
  RevenueData,
  PartnerLedgerEntry,
  DeveloperApiKey,
  DeveloperWebhook,
  AdminRoomType,
  AdminRoom,
  RoomAvailability,
  AvailabilityDay,
  AvailabilityDayStatus,
  AdminReview,
  AdminReviewStatus,
  CmsEntry,
  CmsEntrySeo,
  CmsDestination,
} from '../../types/admin';
import { BookingStatus } from '@safaar/types';
import apiClient from './client';

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AdminNotificationSummary {
  partnerRequests: number;
  supportOpen: number;
}

export interface AdminSettings {
  commissionRate: string;
  busCommissionRate: string;
  maintenanceMode: boolean;
  contactEmail: string;
}

type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): ApiRecord {
  return isRecord(value) ? value : {};
}

function unknownItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  return [];
}

function localizedText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (isRecord(value)) {
    const translations = value;
    return String(
      translations.uz ?? translations.ru ?? translations.en ?? fallback,
    );
  }
  return fallback;
}

function asString(value: unknown, fallback = ''): string {
  return String(value ?? fallback);
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function upperStatus(value: unknown): string {
  return asString(value).toUpperCase();
}

function bookingStatus(value: unknown): AdminHotelBooking['status'] {
  const status = upperStatus(value);
  if (status === BookingStatus.AWAITING_PAYMENT) {
    return BookingStatus.AWAITING_PAYMENT;
  }
  if (status === BookingStatus.AWAITING_PARTNER_CONFIRMATION) {
    return BookingStatus.AWAITING_PARTNER_CONFIRMATION;
  }
  if (status === BookingStatus.CONFIRMED) return BookingStatus.CONFIRMED;
  if (status === BookingStatus.CANCELLED) return BookingStatus.CANCELLED;
  if (status === BookingStatus.COMPLETED) return BookingStatus.COMPLETED;
  if (status === BookingStatus.EXPIRED) return BookingStatus.EXPIRED;
  return BookingStatus.PENDING;
}

function paymentMethod(
  value: unknown,
): AdminHotelBooking['paymentMethod'] | AdminBusBooking['paymentMethod'] {
  const method = asString(value);
  return method === 'payme' || method === 'uzcard' || method === 'humo'
    ? method
    : 'click';
}

function withdrawalStatus(value: unknown): WithdrawalRequest['status'] {
  const status = asString(value).toLowerCase();
  if (status === 'approved' || status === 'paid') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

function supportPriority(value: unknown): SupportTicket['priority'] {
  const priority = asString(value).toLowerCase();
  if (priority === 'low' || priority === 'high') return priority;
  return 'medium';
}

function supportStatus(value: unknown): SupportTicket['status'] {
  const status = asString(value).toLowerCase();
  if (status === 'in_progress' || status === 'closed') return status;
  return 'open';
}

function toRegion(row: ApiRecord): CatalogRegion {
  return {
    id: String(row.id ?? ''),
    name: localizedText(row.name, 'Hudud'),
    hotelsCount: Number(row.hotelsCount ?? row.hotels_count ?? 0),
    isActive: asBoolean(row.isActive ?? row.is_active, true),
  };
}

function toAmenity(row: ApiRecord): CatalogAmenity {
  const code = String(row.code ?? '');
  let type: CatalogAmenity['type'] = 'hotel';

  if (code.startsWith('dacha_')) type = 'dacha';
  else if (code.startsWith('restaurant_')) type = 'restaurant';
  else if (code.startsWith('transport_') || code.startsWith('bus_')) type = 'transport';
  else if (code.startsWith('room_')) type = 'room';
  else if (code.startsWith('hotel_')) type = 'hotel';
  else type = row.type === 'room' ? 'room' : 'hotel';

  return {
    id: String(row.id ?? code ?? ''),
    code,
    name: localizedText(row.name, 'Qulaylik'),
    icon: String(row.icon ?? code ?? 'amenity'),
    type,
    isActive: asBoolean(row.isActive ?? row.is_active, true),
  };
}

function toPartner(row: ApiRecord): Partner {
  return {
    id: asString(row.id),
    companyName: asString(row.brand_name ?? row.legal_name, 'Hamkor'),
    type: partnerType(row.type),
    contactPerson: asString(row.legal_name ?? row.brand_name, "Mas'ul shaxs"),
    phone: asString(row.phone),
    email: asString(row.email),
    city: asString(row.city),
    address: asString(row.address),
    commissionPercent: asNumber(row.default_commission_rate),
    rating: asNumber(row.rating_average),
    totalBookings: asNumber(row.bookings_count),
    totalRevenue: asNumber(row.total_revenue),
    status:
      row.status === 'approved'
        ? 'active'
        : row.status === 'blocked'
          ? 'blocked'
          : row.status === 'suspended'
            ? 'suspended'
            : row.status === 'rejected'
              ? 'rejected'
              : 'reviewing',
    createdAt: asString(row.created_at, new Date().toISOString()),
  };
}

function toPartnerRequest(row: ApiRecord): PartnerRequest {
  return {
    id: asString(row.id),
    companyName: asString(row.brand_name ?? row.legal_name, 'Hamkor arizasi'),
    type: partnerType(row.type),
    contactPerson: asString(row.legal_name ?? row.brand_name, "Mas'ul shaxs"),
    phone: asString(row.phone),
    email: asString(row.email),
    city: asString(row.city),
    address: asString(row.address),
    documents: Array.isArray(row.documents) ? row.documents : [],
    status:
      row.status === 'approved'
        ? 'approved'
        : row.status === 'rejected'
          ? 'rejected'
          : row.status === 'submitted'
            ? 'reviewing'
            : 'new',
    createdAt: asString(row.created_at, new Date().toISOString()),
  };
}

function partnerType(value: unknown): Partner['type'] {
  const type = asString(value).toLowerCase();
  if (
    type === 'bus' ||
    type === 'hostel' ||
    type === 'guesthouse' ||
    type === 'motel' ||
    type === 'dacha' ||
    type === 'restaurant'
  ) {
    return type;
  }
  return 'hotel';
}

function toUser(row: ApiRecord): AdminManagedUser {
  const fullName = String(
    row.full_name ??
      [row.first_name, row.last_name].filter(Boolean).join(' ') ??
      '',
  ).trim();

  return {
    id: asString(row.id),
    fullName: fullName || 'Foydalanuvchi',
    phone: asString(row.phone),
    email: asString(row.email),
    status:
      row.status === 'blocked'
        ? 'blocked'
        : row.status === 'unverified'
          ? 'unverified'
          : 'active',
    bookingsCount: asNumber(row.bookings_count),
    totalSpent: asNumber(row.total_spent),
    bonusBalance: asNumber(row.bonus_balance),
    lastLogin: asString(
      row.last_login_at ?? row.created_at,
      new Date().toISOString(),
    ),
    createdAt: asString(row.created_at, new Date().toISOString()),
  };
}

function toAdminTeamUser(row: ApiRecord): AdminUser {
  return {
    id: asString(row.id),
    fullName: asString(row.full_name ?? row.fullName, 'Admin'),
    email: asString(row.email),
    role: asString(row.role, 'MODERATOR') as AdminRole,
    phone: asString(row.phone),
    lastLogin: asString(row.last_login_at ?? row.lastLogin, new Date().toISOString()),
    isActive: row.status === 'active' || asBoolean(row.is_active ?? row.isActive, true),
    createdAt: asString(row.created_at ?? row.createdAt, new Date().toISOString()),
  };
}

function toHotelBooking(row: ApiRecord): AdminHotelBooking {
  const item = asRecord(row.item);
  return {
    id: asString(row.id),
    partnerId: asString(row.partner_organization_id),
    customerName: asString(row.customer_name, 'Mijoz'),
    customerPhone: asString(row.customer_phone),
    hotelName: asString(row.hotel_name, 'Mehmonxona'),
    partnerType: (['hotel', 'motel', 'hostel', 'dacha', 'guesthouse'] as const).includes(
      row.partner_type as never,
    )
      ? (row.partner_type as AdminHotelBooking['partnerType'])
      : 'hotel',
    roomType: asString(row.room_type_name, 'Xona'),
    checkIn: asString(row.check_in ?? item.check_in),
    checkOut: asString(row.check_out ?? item.check_out),
    nights: asNumber(item.nights, 1),
    guests: asNumber(item.adults, 1) + asNumber(item.children),
    amount: asNumber(row.total_amount),
    paymentMethod: paymentMethod(row.payment_method),
    commission: asNumber(row.commission_amount),
    status: bookingStatus(row.status),
    city: asString(row.city),
    createdAt: asString(row.created_at, new Date().toISOString()),
  };
}

function toBusBooking(row: ApiRecord): AdminBusBooking {
  const item = asRecord(row.item);
  return {
    id: asString(row.id),
    partnerId: asString(row.partner_organization_id),
    customerName: asString(row.customer_name, 'Mijoz'),
    customerPhone: asString(row.customer_phone),
    companyName: asString(row.company_name ?? item.companyName, 'Ijara kompaniyasi'),
    checkIn: asString(row.check_in ?? item.check_in),
    checkOut: asString(row.check_out ?? item.check_out),
    amount: asNumber(row.total_amount),
    paymentMethod: paymentMethod(row.payment_method),
    commission: asNumber(row.commission_amount),
    status: bookingStatus(row.status),
    createdAt: asString(row.created_at, new Date().toISOString()),
  };
}

function toRestaurantBooking(row: ApiRecord): AdminRestaurantBooking {
  const item = asRecord(row.item);
  const priceSnapshot = asRecord(row.price_snapshot ?? row.priceSnapshot);
  return {
    id: asString(row.booking_number ?? row.bookingNumber ?? row.id),
    customerName: asString(
      row.guest_name ??
        row.guestName ??
        priceSnapshot.guestName ??
        priceSnapshot.guest_name ??
        row.user_name ??
        row.userName ??
        row.customer_name ??
        row.customerName,
      'Mijoz',
    ),
    customerPhone: asString(
      row.guest_phone ??
        row.guestPhone ??
        priceSnapshot.guestPhone ??
        priceSnapshot.guest_phone ??
        row.user_phone ??
        row.userPhone ??
        row.customer_phone ??
        row.customerPhone,
      '—',
    ),
    restaurantName: asString(
      row.hotel_name ??
        row.hotelName ??
        item.name ??
        row.partner_name ??
        row.partnerName,
      'Restoran',
    ),
    tableType: asString(
      priceSnapshot.tableName ??
        priceSnapshot.room_type ??
        priceSnapshot.roomType ??
        item.room_type,
      'Stol',
    ),
    date: asString(
      priceSnapshot.check_in ??
        priceSnapshot.checkIn ??
        row.created_at ??
        row.createdAt,
      new Date().toISOString().split('T')[0],
    ),
    slotTime: asString(
      priceSnapshot.slot_time ??
        priceSnapshot.slotTime ??
        row.slot_time ??
        row.slotTime,
      '18:00',
    ),
    guests: asNumber(
      priceSnapshot.adults ?? priceSnapshot.guests ?? row.guests,
      2,
    ),
    amount: asNumber(row.total_amount ?? row.totalAmount ?? row.subtotal),
    paymentMethod: paymentMethod(row.payment_method ?? row.paymentMethod),
    commission: asNumber(row.commission_amount ?? row.commissionAmount),
    status: bookingStatus(row.status),
    createdAt: asString(row.created_at ?? row.createdAt, new Date().toISOString()),
  };
}

function toBookingDetail(row: ApiRecord): BookingDetail {
  const item = asRecord(row.item);
  return {
    id: asString(row.id),
    serviceType: row.type === 'bus' ? 'bus' : 'hotel',
    status: bookingStatus(row.status),
    createdAt: asString(row.created_at, new Date().toISOString()),
    customerName: asString(row.customer_name, 'Mijoz'),
    customerPhone: asString(row.customer_phone),
    customerEmail: asString(row.customer_email),
    customerId: asString(row.user_id),
    hotelName: asString(row.hotel_name),
    hotelAddress: asString(row.hotel_address),
    roomType: asString(row.room_type_name ?? item.room_type),
    checkIn: asString(row.check_in ?? item.check_in),
    checkOut: asString(row.check_out ?? item.check_out),
    nights: asNumber(item.nights, 1),
    guests: asNumber(item.adults, 1) + asNumber(item.children),
    companyName: asString(row.company_name ?? item.companyName),
    route: asString(row.route ?? item.route),
    departureDate: asString(row.departure_date),
    departureTime: asString(row.departure_time),
    seatNumber: asString(row.seat_number ?? item.seatNumber),
    paymentMethod: paymentMethod(row.payment_method),
    totalAmount: asNumber(row.total_amount),
    commission: asNumber(row.commission_amount),
    partnerAmount: asNumber(row.partner_payable),
    transactionId: asString(row.transaction_id),
    paidAt: asString(row.paid_at ?? row.created_at, new Date().toISOString()),
    statusHistory: unknownItems(row.status_history).length
      ? unknownItems(row.status_history).map((entry) => {
          const history = asRecord(entry);
          return {
            status: asString(history.status, asString(row.status)),
            timestamp: asString(
              history.timestamp ?? history.created_at,
              new Date().toISOString(),
            ),
            note:
              history.note === undefined ? undefined : asString(history.note),
          };
        })
      : [
          {
            status: asString(row.status),
            timestamp: asString(row.created_at, new Date().toISOString()),
          },
        ],
  };
}

function toRoomTypes(value: unknown): AdminRoomType[] {
  if (!Array.isArray(value)) return [];
  return value.map((rawType) => {
    const type = asRecord(rawType);
    const rawRooms = Array.isArray(type.rooms) ? type.rooms : [];
    return {
      id: asString(type.id),
      code: asString(type.code),
      name: localizedText(type.name, asString(type.code, 'Xona turi')),
      rooms: rawRooms.map((rawRoom): AdminRoom => {
        const room = asRecord(rawRoom);
        return {
          id: asString(room.id),
          code: asString(room.code),
          name: localizedText(room.name, asString(room.code, 'Xona')),
          totalInventory: asNumber(room.total_inventory),
          basePrice: asNumber(room.base_price),
          status: asString(room.status, 'active'),
        };
      }),
    };
  });
}

function toI18nRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [lang, text] of Object.entries(value)) {
    if (typeof text === 'string') out[lang] = text;
  }
  return out;
}

function toCmsEntry(row: ApiRecord): CmsEntry {
  const metadata = isRecord(row.metadata) ? row.metadata : {};
  const rawSeo = isRecord(metadata.seo) ? metadata.seo : {};
  const seo: CmsEntrySeo = {
    metaTitle: typeof rawSeo.metaTitle === 'string' ? rawSeo.metaTitle : undefined,
    metaDescription:
      typeof rawSeo.metaDescription === 'string' ? rawSeo.metaDescription : undefined,
    canonical: typeof rawSeo.canonical === 'string' ? rawSeo.canonical : undefined,
    robots: typeof rawSeo.robots === 'string' ? rawSeo.robots : undefined,
    ogTitle: typeof rawSeo.ogTitle === 'string' ? rawSeo.ogTitle : undefined,
    ogDescription:
      typeof rawSeo.ogDescription === 'string' ? rawSeo.ogDescription : undefined,
    ogImage: typeof rawSeo.ogImage === 'string' ? rawSeo.ogImage : undefined,
  };
  return {
    id: asString(row.id),
    type: asString(row.type),
    slug: row.slug ? asString(row.slug) : null,
    title: toI18nRecord(row.title_i18n ?? row.title),
    body: toI18nRecord(row.body_i18n ?? row.body),
    status: asString(row.status, 'draft'),
    metadata,
    seo,
    updatedAt: asString(row.updated_at, new Date().toISOString()),
  };
}

function toReview(row: ApiRecord): AdminReview {
  const status = asString(row.status, 'published');
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    userName: asString(row.user_name, 'Mijoz'),
    bookingId: row.booking_id ? asString(row.booking_id) : null,
    targetType: asString(row.target_type),
    targetId: asString(row.target_id),
    targetName: asString(row.target_name, '—'),
    rating: asNumber(row.rating),
    body: asString(row.body),
    photos: Array.isArray(row.photos)
      ? row.photos.map((p) => String(p))
      : [],
    status: (['published', 'hidden', 'pending_review'].includes(status)
      ? status
      : 'published') as AdminReviewStatus,
    createdAt: asString(row.created_at, new Date().toISOString()),
    updatedAt: asString(row.updated_at, new Date().toISOString()),
  };
}

function toListing(row: ApiRecord): AdminListing {
  const partner = asRecord(row.partner);
  const rawRules = isRecord(row.rules) ? row.rules : undefined;
  const roomSummary = asRecord(row.room_summary);
  const rawPhotos = Array.isArray(row.photos)
    ? row.photos
    : Array.isArray(row.images)
      ? row.images
      : Array.isArray(row.media)
        ? row.media
        : [];
  const photos = rawPhotos.flatMap((photo) => {
    if (typeof photo === 'string') return [photo];
    const record = asRecord(photo);
    return typeof record.url === 'string' ? [record.url] : [];
  });
  const amenities = Array.isArray(row.amenities)
    ? row.amenities.map((amenity) => {
        const record = asRecord(amenity);
        return typeof amenity === 'string'
          ? amenity
          : localizedText(record.name, asString(record.code, 'Qulaylik'));
      })
    : [];

  return {
    id: asString(row.id),
    partnerId: asString(row.partner_organization_id),
    companyName: localizedText(
      row.company_name ??
        row.brand_name ??
        row.legal_name ??
        partner.brand_name ??
        partner.legal_name,
    ),
    hotelName: localizedText(row.name, asString(row.slug, 'Mehmonxona')),
    city: localizedText(row.city_name ?? row.city),
    address: asString(row.address),
    latitude: asOptionalNumber(row.latitude),
    longitude: asOptionalNumber(row.longitude),
    stars: asNumber(row.stars),
    featured: asBoolean(row.featured, false),
    featuredOrder: asOptionalNumber(row.featured_order),
    photos,
    description: localizedText(
      row.description ?? row.full_description ?? row.short_description,
    ),
    amenities,
    rules: rawRules
      ? {
          checkInTime:
            rawRules.checkInTime === undefined &&
            rawRules.check_in_time === undefined
              ? undefined
              : asString(rawRules.checkInTime ?? rawRules.check_in_time),
          checkOutTime:
            rawRules.checkOutTime === undefined &&
            rawRules.check_out_time === undefined
              ? undefined
              : asString(rawRules.checkOutTime ?? rawRules.check_out_time),
          childrenAllowed: asOptionalBoolean(
            rawRules.childrenAllowed ?? rawRules.children_allowed,
          ),
          petsAllowed: asOptionalBoolean(
            rawRules.petsAllowed ?? rawRules.pets_allowed,
          ),
          smokingAllowed: asOptionalBoolean(
            rawRules.smokingAllowed ?? rawRules.smoking_allowed,
          ),
          cancellationPolicy:
            rawRules.cancellationPolicy === undefined &&
            rawRules.cancellation_policy_code === undefined
              ? undefined
              : asString(
                  rawRules.cancellationPolicy ??
                    rawRules.cancellation_policy_code,
                ),
        }
      : undefined,
    roomsCount: asOptionalNumber(
      row.rooms_count ??
        roomSummary.active_room_count ??
        roomSummary.total_inventory,
    ),
    roomTypes: toRoomTypes(row.room_types),
    type:
      row.type || partner.type || row.listing_type
        ? asString(row.type ?? partner.type ?? row.listing_type)
        : undefined,
    status:
      row.status === 'published'
        ? 'published'
        : row.status === 'rejected'
          ? 'rejected'
          : row.status === 'draft'
            ? 'draft'
            : 'under_review',
    submittedAt: asString(
      row.submitted_at ?? row.created_at,
      new Date().toISOString(),
    ),
    completeness: isRecord(row.completeness)
      ? {
          isPublishable: Boolean(
            row.completeness.is_publishable ?? row.completeness.isPublishable,
          ),
          missingFields: Array.isArray(
            row.completeness.missing_fields ?? row.completeness.missingFields,
          )
            ? ((row.completeness.missing_fields ??
                row.completeness.missingFields) as unknown[]).map((field) =>
                String(field),
              )
            : [],
        }
      : undefined,
  };
}

function toPromo(row: ApiRecord): PromoCode {
  const discountType = asString(row.discountType ?? row.discount_type)
    .toLowerCase()
    .startsWith('percent')
    ? 'percent'
    : 'fixed';
  const active = row.isActive ?? row.is_active;

  return {
    id: asString(row.id ?? row.code),
    code: asString(row.code, 'PROMO').toUpperCase(),
    discountType,
    discountValue: asNumber(row.discountValue ?? row.discount_value),
    usageLimit: asNumber(row.usageLimit ?? row.usage_limit),
    usedCount: asNumber(row.usedCount ?? row.used_count),
    validUntil: asString(
      row.validUntil ?? row.valid_until ?? row.updated_at,
      new Date().toISOString(),
    ),
    isActive:
      typeof active === 'boolean'
        ? active
        : asString(row.status, 'published') === 'published',
  };
}

function toCmsBanner(row: ApiRecord): CmsBanner {
  const metadata = asRecord(row.metadata);
  return {
    id: asString(row.id),
    title: localizedText(row.title, asString(row.slug, 'Banner')),
    imageUrl: asString(row.imageUrl ?? row.image_url ?? metadata.imageUrl),
    link: asString(row.link ?? metadata.link, '/'),
    isActive:
      typeof row.isActive === 'boolean'
        ? row.isActive
        : asString(row.status) === 'published' ||
          asString(row.status) === 'active',
    order: asNumber(row.order ?? metadata.order),
  };
}

function toCmsDestination(row: ApiRecord): CmsDestination {
  const metadata = asRecord(row.metadata);
  return {
    id: asString(row.id),
    title: localizedText(row.title, asString(row.slug, "Yo'nalish")),
    imageUrl: asString(row.imageUrl ?? row.image_url ?? metadata.imageUrl ?? metadata.image_url),
    link: asString(row.link ?? metadata.link, '/'),
    isActive:
      typeof row.isActive === 'boolean'
        ? row.isActive
        : asString(row.status) === 'published' ||
          asString(row.status) === 'active',
    order: asNumber(row.order ?? metadata.order ?? metadata.sortOrder),
  };
}

function toCmsArticle(row: ApiRecord, type?: CmsArticle['type']): CmsArticle {
  const rowType = asString(row.type);
  const articleType: CmsArticle['type'] =
    type ??
    (rowType === 'offer' || rowType === 'promo'
      ? 'offer'
      : rowType === 'page'
        ? 'page'
        : 'news');

  return {
    id: asString(row.id),
    title: localizedText(row.title, asString(row.slug, 'Kontent')),
    type: articleType,
    slug: asString(row.slug),
    status: asString(row.status) === 'published' ? 'published' : asString(row.status) === 'pending_review' ? 'pending_review' : 'draft',
    publishedAt: asString(
      row.publishedAt ?? row.published_at ?? row.created_at,
      new Date().toISOString(),
    ),
    metadata: isRecord(row.metadata) ? row.metadata : undefined,
  };
}

function toWithdrawal(row: ApiRecord): WithdrawalRequest {
  return {
    id: asString(row.id),
    partnerId: asString(row.partnerId ?? row.partner_id),
    partnerName: asString(row.partnerName ?? row.partner_name, 'Hamkor'),
    amount: asNumber(row.amount),
    requestDate: asString(
      row.requestDate ?? row.request_date ?? row.created_at,
      new Date().toISOString(),
    ),
    status: withdrawalStatus(row.status),
    bankAccount: asString(row.bankAccount ?? row.bank_account),
  };
}

function toBroadcast(row: ApiRecord): BroadcastNotification {
  return {
    id: asString(row.id),
    title: localizedText(row.title, 'Xabarnoma'),
    message: localizedText(row.message ?? row.body, ''),
    targetType: asString(row.target_type ?? row.targetType, 'all') as 'all' | 'users' | 'partners',
    status: asString(row.status, 'draft') as 'draft' | 'sending' | 'sent' | 'failed',
    sentCount: asNumber(row.sent_count ?? row.sentCount),
    createdAt: asString(row.created_at ?? row.createdAt, new Date().toISOString()),
  };
}

function paymentProvider(value: unknown): AdminPaymentTransaction['provider'] {
  const p = asString(value).toLowerCase();
  if (p === 'payme' || p === 'uzcard' || p === 'humo' || p === 'stripe') return p;
  return 'click';
}

function paymentTransactionStatus(value: unknown): AdminPaymentTransaction['status'] {
  const s = asString(value).toLowerCase();
  if (s === 'success' || s === 'failed' || s === 'refunded') return s;
  return 'pending';
}

function toPaymentTransaction(row: ApiRecord): AdminPaymentTransaction {
  return {
    id: asString(row.id),
    bookingId: asString(row.booking_id ?? row.bookingId),
    customerName: asString(row.customer_name ?? row.customerName, 'Mijoz'),
    amount: asNumber(row.amount),
    provider: paymentProvider(row.provider),
    status: paymentTransactionStatus(row.status),
    providerTransactionId: asString(row.provider_transaction_id ?? row.providerTransactionId) || undefined,
    createdAt: asString(row.created_at ?? row.createdAt, new Date().toISOString()),
  };
}

function refundTransactionStatus(value: unknown): AdminRefundTransaction['status'] {
  const s = asString(value).toLowerCase();
  if (s === 'approved' || s === 'rejected' || s === 'failed' || s === 'completed') return s;
  return 'pending';
}

function toRefundTransaction(row: ApiRecord): AdminRefundTransaction {
  return {
    id: asString(row.id),
    paymentId: asString(row.payment_id ?? row.paymentId),
    bookingId: asString(row.booking_id ?? row.bookingId),
    customerName: asString(row.customer_name ?? row.customerName, 'Mijoz'),
    amount: asNumber(row.amount),
    reason: asString(row.reason, 'Sabab ko\'rsatilmagan'),
    status: refundTransactionStatus(row.status),
    createdAt: asString(row.created_at ?? row.createdAt, new Date().toISOString()),
  };
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  support_tickets: "Support so'rovi",
  partner_organizations: 'Hamkor tashkiloti',
  bookings: 'Bron',
  users: 'Foydalanuvchi',
  hotels: 'Mehmonxona',
  partners: 'Hamkor',
};

function auditTargetLabel(rawTarget: string): string {
  if (!rawTarget) return '—';
  const separatorIndex = rawTarget.indexOf(':');
  if (separatorIndex === -1) return rawTarget;
  const entityType = rawTarget.slice(0, separatorIndex);
  const entityId = rawTarget.slice(separatorIndex + 1);
  if (!entityType) return entityId;
  const label = ENTITY_TYPE_LABELS[entityType] ?? entityType;
  const shortId = entityId.length > 8 ? `…${entityId.slice(-8)}` : entityId;
  return entityId ? `${label} (${shortId})` : label;
}

function toAuditLog(row: ApiRecord) {
  const metadata = asRecord(row.metadata);
  return {
    id: asString(row.id),
    user: asString(row.actor_name ?? row.actor_id ?? row.actor_type, 'Admin'),
    action: activityMessage(asString(row.action), metadata),
    target: auditTargetLabel(
      asString(metadata.target ?? row.entity_id ?? row.entity_type ?? row.request_id),
    ),
    ip: asString(row.ip_address),
    date: asString(row.created_at, new Date().toISOString()),
  };
}

const SETTINGS_GROUP_LABELS: Record<string, string> = {
  general: "Umumiy sozlamalar",
  finance: 'Moliya sozlamalari',
  notifications: 'Bildirishnoma sozlamalari',
};

function activityMessage(action: string, metadata: ApiRecord): string {
  switch (action) {
    case 'partner.moderation': {
      const status = asString(metadata.status);
      const verdict =
        status === 'approved'
          ? 'tasdiqlandi'
          : status === 'rejected'
            ? 'rad etildi'
            : status || "ko'rib chiqildi";
      return `Hamkor arizasi ${verdict}`;
    }
    case 'partner.status':
      return `Hamkor holati o'zgartirildi: ${asString(metadata.status, '—')}`;
    case 'partner.commission':
      return "Hamkor komissiya foizi o'zgartirildi";
    case 'partner.adjustment':
      return "Hamkor balansiga tuzatish kiritildi";
    case 'partner.delete':
      return "Hamkor o'chirildi";
    case 'settings.update': {
      const group = asString(metadata.group);
      return `Sozlamalar yangilandi: ${SETTINGS_GROUP_LABELS[group] ?? (group || 'umumiy')}`;
    }
    case 'booking.admin_cancel':
      return 'Bron administrator tomonidan bekor qilindi';
    case 'user.admin_delete':
      return "Foydalanuvchi o'chirildi";
    case 'user.admin_message':
      return 'Foydalanuvchiga xabar yuborildi';
    case 'user.bonus_adjustment':
      return "Foydalanuvchi bonus balansi o'zgartirildi";
    case 'partner_request':
      return 'Yangi hamkor arizasi tushdi';
    case 'booking_created':
      return 'Yangi bron yaratildi';
    case 'booking_cancelled':
      return 'Bron bekor qilindi';
    case 'complaint':
      return 'Yangi shikoyat/murojaat tushdi';
    case 'user_registered':
      return "Yangi foydalanuvchi ro'yxatdan o'tdi";
    default:
      return action || 'Admin harakati';
  }
}

function toActivityLog(row: ApiRecord): ActivityLogItem {
  const action = asString(row.action);
  const metadata = asRecord(row.metadata);
  const type: ActivityLogItem['type'] = action.includes('partner')
    ? 'partner_request'
    : action.includes('booking') || action.includes('bron')
      ? action.includes('cancel')
        ? 'booking_cancelled'
        : 'booking_created'
      : action.includes('payment') || action.includes('withdrawal')
        ? 'payment_request'
        : action.includes('support') || action.includes('complaint')
          ? 'complaint'
          : 'user_registered';
  const icon =
    type === 'partner_request'
      ? 'Building'
      : type === 'payment_request'
        ? 'Wallet'
        : type === 'booking_cancelled'
          ? 'XCircle'
          : type === 'complaint'
            ? 'AlertTriangle'
            : type === 'booking_created'
              ? 'CalendarPlus'
              : 'UserPlus';

  return {
    id: asString(row.id),
    type,
    message: activityMessage(action, metadata),
    timestamp: asString(row.created_at, new Date().toISOString()),
    icon,
  };
}

function toFinanceReport(row: ApiRecord, index: number): FinanceReport {
  const partnerName = asString(
    row.partner_name ?? row.brand_name ?? row.legal_name,
    'Hamkor',
  );
  const generatedAt = asString(row.created_at, new Date().toISOString());
  return {
    id: asString(row.id ?? row.partner_id, `finance-report-${index}`),
    title: asString(row.title, `${partnerName} moliya hisoboti`),
    period: asString(row.period, 'Joriy davr'),
    totalRevenue: asNumber(row.totalRevenue ?? row.total_revenue),
    totalCommission: asNumber(
      row.totalCommission ?? row.total_commission ?? row.commission,
    ),
    dateGenerated: asString(
      row.dateGenerated ?? row.date_generated,
      generatedAt,
    ),
  };
}

function toNotification(row: ApiRecord): AdminNotification {
  return {
    id: asString(row.id),
    title: localizedText(row.title, 'Bildirishnoma'),
    message: localizedText(row.message ?? row.body, ''),
    isRead: Boolean(row.isRead ?? row.is_read ?? row.read_at),
    createdAt: asString(
      row.createdAt ?? row.created_at,
      new Date().toISOString(),
    ),
  };
}

function toSupportTicket(row: ApiRecord): SupportTicket {
  const customerName = asString(
    row.contact_name ?? row.contactName ?? row.customer_name ?? row.customerName,
    'Mijoz',
  ).trim();
  const businessName =
    localizedText(
      row.business_name ??
        row.businessName ??
        row.partner_name ??
        row.partnerName ??
        row.organization_name ??
        row.organizationName,
    ).trim() || undefined;
  const hotelName =
    localizedText(row.hotel_name ?? row.hotelName, '').trim() || undefined;
  const companyName =
    localizedText(row.company_name ?? row.companyName, '').trim() || undefined;
  const taxId =
    asString(
      row.tax_id ??
        row.taxId ??
        row.stir ??
        row.partner_tax_id ??
        row.partnerTaxId,
    ).trim() || undefined;

  return {
    id: asString(row.id),
    subject: asString(row.subject, 'Murojaat'),
    customerName: customerName || 'Mijoz',
    customerType: row.customer_type === 'partner' ? 'partner' : 'user',
    contactName: customerName || undefined,
    businessName,
    hotelName,
    companyName,
    taxId,
    partnerId:
      asString(
        row.partner_organization_id ??
          row.partnerOrganizationId ??
          row.partner_id ??
          row.partnerId,
      ).trim() || undefined,
    status: supportStatus(row.status),
    priority: supportPriority(row.priority),
    assignee:
      row.assignee === undefined && row.assignee_name === undefined
        ? undefined
        : asString(row.assignee ?? row.assignee_name),
    createdAt: asString(
      row.created_at ?? row.createdAt,
      new Date().toISOString(),
    ),
  };
}

function toTicketMessage(row: ApiRecord): TicketMessage {
  return {
    id: asString(row.id),
    ticketId: asString(row.ticketId ?? row.ticket_id),
    senderName: asString(row.senderName ?? row.sender_name, 'Foydalanuvchi'),
    senderRole: row.sender_type === 'admin' || row.senderRole === 'admin' ? 'admin' : 'customer',
    message: asString(row.message ?? row.body),
    createdAt: asString(row.createdAt ?? row.created_at, new Date().toISOString()),
  };
}

function cmsBannerPayload(banner: Omit<CmsBanner, 'id'> | Partial<CmsBanner>) {
  return {
    slug:
      typeof banner.title === 'string'
        ? banner.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')
        : undefined,
    title: { uz: banner.title ?? '' },
    metadata: {
      imageUrl: banner.imageUrl ?? '',
      link: banner.link ?? '/',
      order: banner.order ?? 0,
    },
  };
}

function cmsDestinationPayload(
  destination: Omit<CmsDestination, 'id'> | Partial<CmsDestination>,
) {
  const payload: Record<string, unknown> = {};
  if (destination.title !== undefined) {
    payload.slug = destination.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    payload.title = {
      uz: destination.title,
      ru: destination.title,
      en: destination.title,
    };
  }
  const metadata: Record<string, unknown> = {};
  if (destination.imageUrl !== undefined) metadata.imageUrl = destination.imageUrl;
  if (destination.link !== undefined) metadata.link = destination.link || '/';
  if (destination.order !== undefined) metadata.order = destination.order;
  if (Object.keys(metadata).length > 0) payload.metadata = metadata;
  return payload;
}

export interface PartnerPromotion {
  id: string;
  partnerId: string;
  partnerName: string;
  entityId: string;
  entityType: "room" | "vehicle";
  entityName: string;
  oldPriceSum: number;
  newPriceSum: number;
  discountPercent: number;
  startDate: string;
  endDate: string;
  status: "pending_review" | "published" | "rejected";
  createdAt: string;
}

function toPartnerPromotion(row: ApiRecord): PartnerPromotion {
  return {
    id: String(row.id ?? ''),
    partnerId: String(row.partnerId ?? ''),
    partnerName: String(row.partnerName ?? ''),
    entityId: String(row.entityId ?? ''),
    entityType: row.entityType === 'vehicle' ? 'vehicle' : 'room',
    entityName: String(row.entityName ?? ''),
    oldPriceSum: Number(row.oldPriceSum ?? 0),
    newPriceSum: Number(row.newPriceSum ?? 0),
    discountPercent: Number(row.discountPercent ?? 0),
    startDate: String(row.startDate ?? ''),
    endDate: String(row.endDate ?? ''),
    status:
      row.status === 'published' || row.status === 'rejected'
        ? row.status
        : 'pending_review',
    createdAt: String(row.createdAt ?? ''),
  };
}

export const AdminApi = {
  // Media Upload
  uploadMedia: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<{ url: string }>('/uploads/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },
  
  // Auth
  login: async (username: string, password: string) => {
    const { data } = await apiClient.post('/auth/admin/login', {
      username,
      password,
    });
    if (data.requires_2fa) {
      return { requires2FA: true, challengeId: data.challenge_id };
    }
    const token = data.accessToken ?? data.access_token;
    if (!token) {
      throw new Error('Login token qaytmadi');
    }
    return {
      requires2FA: false,
      token,
      user: {
        id: data.admin?.id ?? 'admin',
        name: data.admin?.full_name ?? data.admin?.email ?? 'Admin',
        email: data.admin?.email ?? username,
        role: data.admin?.role ?? 'SUPER_ADMIN',
        has2FA: data.admin?.has_2fa ?? false,
      },
    };
  },

  verify2FA: async (challengeId: string, code: string) => {
    const { data } = await apiClient.post('/auth/admin/verify-2fa', {
      challenge_id: challengeId,
      code,
    });
    const token = data.accessToken ?? data.access_token;
    if (!token) {
      throw new Error('Login token qaytmadi');
    }
    return {
      token,
      user: {
        id: data.admin?.id ?? 'admin',
        name: data.admin?.full_name ?? data.admin?.email ?? 'Admin',
        email: data.admin?.email ?? 'admin@safaar.uz',
        role: data.admin?.role ?? 'SUPER_ADMIN',
        has2FA: data.admin?.has_2fa ?? true,
      },
    };
  },

  setup2FA: async () => {
    const { data } = await apiClient.post('/auth/admin/2fa/setup');
    return data as {
      setup_id: string;
      otpauth_url: string;
      secret: string;
      recovery_codes: string[];
      expires_in_seconds: number;
    };
  },

  confirm2FA: async (setupId: string, code: string) => {
    const { data } = await apiClient.post('/auth/admin/2fa/confirm', {
      setup_id: setupId,
      code,
    });
    return data;
  },

  disable2FA: async () => {
    const { data } = await apiClient.post('/auth/admin/2fa/disable');
    return data;
  },

  // Users
  getUsers: async (): Promise<AdminManagedUser[]> => {
    const { data } = await apiClient.get('/admin/users');
    return unknownItems(data).map((row) => toUser(asRecord(row)));
  },

  getUser: async (id: string): Promise<AdminManagedUser> => {
    const { data } = await apiClient.get(`/admin/users/${id}`);
    return toUser(asRecord(data));
  },

  updateUserStatus: async (
    id: string,
    status: AdminManagedUser['status'],
  ): Promise<AdminManagedUser> => {
    const { data } = await apiClient.patch(`/admin/users/${id}/status`, {
      status,
    });
    return toUser(asRecord(data));
  },

  deleteUser: async (id: string): Promise<AdminManagedUser> => {
    const { data } = await apiClient.delete(`/admin/users/${id}`);
    return toUser(asRecord(data));
  },

  getUserBookings: async (id: string): Promise<AdminHotelBooking[]> => {
    const { data } = await apiClient.get(`/admin/users/${id}/bookings`);
    return unknownItems(data).map((row) => toHotelBooking(asRecord(row)));
  },

  adjustUserBonus: async (id: string, amount: number, reason?: string): Promise<number> => {
    const { data } = await apiClient.post(`/admin/users/${id}/bonus-adjustment`, {
      amount,
      reason,
    });
    return asNumber(asRecord(data).balance);
  },

  // Partners
  getPartners: async (): Promise<Partner[]> => {
    const { data } = await apiClient.get('/admin/partners');
    return unknownItems(data).map((row) => toPartner(asRecord(row)));
  },

  getPartner: async (id: string): Promise<Partner> => {
    const { data } = await apiClient.get(`/admin/partners/${id}`);
    return toPartner(asRecord(data));
  },

  getPartnerRequests: async (): Promise<PartnerRequest[]> => {
    const { data } = await apiClient.get('/admin/partners/requests');
    return unknownItems(data).map((row) => toPartnerRequest(asRecord(row)));
  },

  approvePartner: async (id: string) => {
    const { data } = await apiClient.post(`/admin/partners/${id}/approve`);
    return data;
  },

  rejectPartner: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/admin/partners/${id}/reject`, {
      reason: reason ?? '',
    });
    return data;
  },

  updatePartnerStatus: async (id: string, status: Partner['status']) => {
    const { data } = await apiClient.patch(`/admin/partners/${id}/status`, {
      status,
    });
    return toPartner(asRecord(data));
  },

  deletePartner: async (id: string) => {
    const { data } = await apiClient.delete(`/admin/partners/${id}`);
    return data;
  },

  updatePartnerCommission: async (id: string, rate: number) => {
    const { data } = await apiClient.patch(`/admin/partners/${id}/commission`, {
      rate,
    });
    return toPartner(asRecord(data));
  },

  getPartnerLedger: async (id: string): Promise<PartnerLedgerEntry[]> => {
    const { data } = await apiClient.get(`/admin/partners/${id}/ledger`);
    return unknownItems(data).map((row) => {
      const r = asRecord(row);
      const type = asString(r.type);
      return {
        id: asString(r.id),
        partnerId: asString(r.partner_id ?? r.partnerId),
        type: (['booking_revenue','commission_fee','withdrawal','adjustment','refund'] as const).includes(type as PartnerLedgerEntry['type'])
          ? (type as PartnerLedgerEntry['type'])
          : 'adjustment',
        amount: asNumber(r.amount),
        balanceAfter: asNumber(r.balance_after ?? r.balanceAfter),
        description: asString(r.description, '—'),
        referenceId: r.reference_id ? asString(r.reference_id) : undefined,
        createdAt: asString(r.created_at ?? r.createdAt, new Date().toISOString()),
      } satisfies PartnerLedgerEntry;
    });
  },

  addPartnerAdjustment: async (id: string, payload: { amount: number; description: string; type: 'adjustment' | 'refund' }): Promise<PartnerLedgerEntry> => {
    const { data } = await apiClient.post(`/admin/partners/${id}/adjustment`, payload);
    const r = asRecord(data);
    const type = asString(r.type);
    return {
      id: asString(r.id),
      partnerId: asString(r.partner_id ?? r.partnerId, id),
      type: (['booking_revenue','commission_fee','withdrawal','adjustment','refund'] as const).includes(type as PartnerLedgerEntry['type'])
        ? (type as PartnerLedgerEntry['type'])
        : 'adjustment',
      amount: asNumber(r.amount),
      balanceAfter: asNumber(r.balance_after ?? r.balanceAfter),
      description: asString(r.description, payload.description),
      referenceId: r.reference_id ? asString(r.reference_id) : undefined,
      createdAt: asString(r.created_at ?? r.createdAt, new Date().toISOString()),
    } satisfies PartnerLedgerEntry;
  },

  // Developer (API & Webhooks)
  getDeveloperApiKeys: async (): Promise<DeveloperApiKey[]> => {
    const { data } = await apiClient.get('/admin/developer/api-keys');
    return unknownItems(data).map((row) => {
      const r = asRecord(row);
      const org = asRecord(r.partner_organization ?? r.partnerOrganization);
      return {
        id: asString(r.id),
        partnerId: asString(r.partner_organization_id ?? r.partnerId),
        partnerName: asString(org.brand_name ?? org.legal_name ?? r.partner_name ?? r.partnerName, 'Hamkor'),
        name: asString(r.name, 'API Key'),
        keyPrefix: asString(r.key_prefix ?? r.keyPrefix, ''),
        lastUsedAt: r.last_used_at ? asString(r.last_used_at) : undefined,
        createdAt: asString(r.created_at ?? r.createdAt, new Date().toISOString()),
      } satisfies DeveloperApiKey;
    });
  },

  deleteDeveloperApiKey: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/developer/api-keys/${id}`);
  },

  getDeveloperWebhooks: async (): Promise<DeveloperWebhook[]> => {
    const { data } = await apiClient.get('/admin/developer/webhooks');
    return unknownItems(data).map((row) => {
      const r = asRecord(row);
      const org = asRecord(r.partner_organization ?? r.partnerOrganization);
      return {
        id: asString(r.id),
        partnerId: asString(r.partner_organization_id ?? r.partnerId),
        partnerName: asString(org.brand_name ?? org.legal_name ?? r.partner_name ?? r.partnerName, 'Hamkor'),
        url: asString(r.url),
        events: Array.isArray(r.events) ? r.events.map(String) : [],
        isActive: asBoolean(r.is_active ?? r.isActive, true),
        failedDeliveries: asNumber(r.failed_deliveries ?? r.failedDeliveries),
        createdAt: asString(r.created_at ?? r.createdAt, new Date().toISOString()),
      } satisfies DeveloperWebhook;
    });
  },

  // Team (Admin Users)
  getTeamUsers: async (): Promise<AdminUser[]> => {
    const { data } = await apiClient.get('/admin/admin-users');
    return unknownItems(data).map(row => toAdminTeamUser(asRecord(row)));
  },
  
  createTeamUser: async (input: Partial<AdminUser> & { password?: string }): Promise<AdminUser> => {
    const { data } = await apiClient.post('/admin/admin-users', {
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      role: input.role,
      password: input.password,
    });
    return toAdminTeamUser(asRecord(data));
  },
  
  updateTeamUser: async (id: string, input: Partial<AdminUser>): Promise<AdminUser> => {
    const { data } = await apiClient.patch(`/admin/admin-users/${id}`, {
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      role: input.role,
    });
    return toAdminTeamUser(asRecord(data));
  },
  
  updateTeamUserStatus: async (id: string, isActive: boolean): Promise<void> => {
    await apiClient.patch(`/admin/admin-users/${id}/status`, {
      status: isActive ? 'active' : 'blocked'
    });
  },
  
  resetTeamUser2FA: async (id: string): Promise<void> => {
    await apiClient.post(`/admin/admin-users/${id}/reset-2fa`);
  },

  // Real backend permission matrix — GET /admin/roles reads directly from
  // `common/permissions.ts`'s `rolePermissions` (the actual enforcement
  // map RolesGuard uses), not a separately-maintained/fake list.
  getRoles: async (): Promise<{ id: string; permissions: string[] }[]> => {
    const { data } = await apiClient.get('/admin/roles');
    return unknownItems(data).map((row) => {
      const r = asRecord(row);
      return {
        id: asString(r.id),
        permissions: Array.isArray(r.permissions)
          ? r.permissions.map((p) => String(p))
          : [],
      };
    });
  },

  // Bookings
  getBookings: async (): Promise<AdminHotelBooking[]> => {
    const { data } = await apiClient.get('/admin/bookings');
    return unknownItems(data)
      .map(asRecord)
      .filter((booking) => booking.type !== 'bus' && booking.type !== 'restaurant')
      .map(toHotelBooking);
  },

  getBusBookings: async (): Promise<AdminBusBooking[]> => {
    const { data } = await apiClient.get('/admin/bookings');
    return unknownItems(data)
      .map(asRecord)
      .filter((booking) => booking.type === 'bus')
      .map(toBusBooking);
  },

  getRestaurantBookings: async (): Promise<AdminRestaurantBooking[]> => {
    const { data } = await apiClient.get('/admin/bookings');
    return unknownItems(data)
      .map(asRecord)
      .filter((booking) => booking.type === 'restaurant')
      .map(toRestaurantBooking);
  },

  getBookingDetail: async (id: string): Promise<BookingDetail> => {
    const { data } = await apiClient.get(`/admin/bookings/${id}`);
    return toBookingDetail(asRecord(data));
  },

  cancelBooking: async (
    id: string,
    reason?: string,
  ): Promise<BookingDetail> => {
    await apiClient.post(`/admin/bookings/${id}/cancel`, {
      reason: reason ?? 'Admin cancel',
    });
    return AdminApi.getBookingDetail(id);
  },

  // Dashboard
  getDashboardStats: async () => {
    const { data } = await apiClient.get('/admin/dashboard/overview');
    return {
      totalUsers: data.totalUsers ?? data.total_users ?? 0,
      totalPartners:
        data.activePartners ?? data.active_partners ?? data.total_partners ?? 0,
      totalBookings:
        data.todayBookings ?? data.today_bookings ?? data.total_bookings ?? 0,
      revenue: data.monthlyRevenue ?? data.monthly_revenue ?? data.revenue ?? 0,
    };
  },

  getActivity: async (): Promise<ActivityLogItem[]> => {
    const { data } = await apiClient.get('/admin/dashboard/activity');
    return unknownItems(data).map((row) => toActivityLog(asRecord(row)));
  },

  getAuditLogs: async () => {
    const { data } = await apiClient.get('/admin/audit-logs');
    return unknownItems(data).map((row) => toAuditLog(asRecord(row)));
  },

  getNotificationSummary: async (): Promise<AdminNotificationSummary> => {
    try {
      const [partnerRequests, supportStatsResponse] = await Promise.all([
        AdminApi.getPartnerRequests().catch(() => []),
        apiClient.get('/admin/support/stats').catch(() => ({ data: { open: 0, closed: 0 } })),
      ]);
      const supportStats = asRecord(supportStatsResponse.data);

      return {
        partnerRequests: partnerRequests.filter(
          (request) => request.status === 'new' || request.status === 'reviewing',
        ).length,
        supportOpen: Number(supportStats.open ?? 0),
      };
    } catch (error) {
      console.error('Error fetching notification summary:', error);
      return { partnerRequests: 0, supportOpen: 0 };
    }
  },

  getNotifications: async (): Promise<AdminNotification[]> => {
    const { data } = await apiClient.get('/notifications');
    return unknownItems(data).map((row) => toNotification(asRecord(row)));
  },

  markNotificationRead: async (id: string): Promise<AdminNotification> => {
    const { data } = await apiClient.patch(`/notifications/${id}/read`);
    return toNotification(asRecord(data));
  },

  markAllNotificationsRead: async () => {
    const { data } = await apiClient.patch('/notifications/read-all');
    return data;
  },

  // Broadcasts
  getBroadcasts: async (): Promise<BroadcastNotification[]> => {
    const { data } = await apiClient.get('/admin/notifications/broadcasts');
    return unknownItems(data).map((row) => toBroadcast(asRecord(row)));
  },
  
  createBroadcast: async (input: { title: string, body: string, targetType: string }): Promise<BroadcastNotification> => {
    const { data } = await apiClient.post('/admin/notifications/broadcast', {
      title: input.title,
      body: input.body,
      target_type: input.targetType
    });
    return toBroadcast(asRecord(data));
  },
  
  broadcastAction: async (id: string, action: 'send' | 'cancel'): Promise<BroadcastNotification> => {
    const { data } = await apiClient.post(`/admin/notifications/broadcasts/${id}/${action}`);
    return toBroadcast(asRecord(data));
  },

  // Finance
  getFinanceOverview: async (): Promise<FinanceOverviewData> => {
    const { data } = await apiClient.get('/admin/finance/overview');
    const r = asRecord(data);
    return {
      totalRevenue: asNumber(r.gross_amount ?? r.total_revenue ?? r.totalRevenue),
      // `paid_amount` is total collected payments, NOT commission — was
      // mismapped here (2026-09-19 audit). Real commission source:
      // bookings.commission_amount (same field partnersReport() uses).
      totalCommission: asNumber(r.total_commission ?? r.totalCommission),
      pendingWithdrawals: asNumber(r.pending_withdrawals ?? r.pendingWithdrawals),
      paidWithdrawals: asNumber(r.paid_withdrawals ?? r.paidWithdrawals),
      totalRefunds: asNumber(r.total_refunds ?? r.totalRefunds),
    } satisfies FinanceOverviewData;
  },

  getFinanceRevenueChart: async (): Promise<RevenueData[]> => {
    // Backendning chart('finance-revenue') soxta qiymat qaytaradi.
    // O'rniga partners-report dan jami daromadlarni hisoblab bitta joriy oylik chart tuzamiz.
    const { data } = await apiClient.get('/admin/finance/partners-report');
    const reports = unknownItems(data).map(r => asRecord(r));
    
    const totalRev = reports.reduce((acc, r) => acc + asNumber(r.total_revenue), 0);
    const totalCom = reports.reduce((acc, r) => acc + asNumber(r.total_commission), 0);
    
    return [
      {
        month: new Date().toISOString().slice(0, 7),
        commission: totalCom,
        partnerPayment: totalRev - totalCom,
      }
    ] satisfies RevenueData[];
  },

  getProviderReconciliation: async (): Promise<ProviderReconciliation[]> => {
    // Backend hozirgacha providerReconciliation uchun guruhlangan emas, tranzaksiyalar qaytaradi.
    // Shuning uchun biz to'g'ridan-to'g'ri /admin/payments dan olib, frontendda guruhlaymiz (robust approach).
    const { data } = await apiClient.get('/admin/payments');
    
    const providerMap: Record<string, { expected: number, actual: number, lastSync: string }> = {};
    
    for (const r of unknownItems(data)) {
       const p = asRecord(r);
       const provider = asString(p.provider) || 'noma\'lum';
       const amount = asNumber(p.amount);
       const status = asString(p.status);
       
       if (!providerMap[provider]) {
         providerMap[provider] = { expected: 0, actual: 0, lastSync: asString(p.created_at ?? p.createdAt, new Date().toISOString()) };
       }
       
       // PaymentStatus (schema.prisma): pending | awaiting_cash | processing |
       // paid | failed | refunded | reversed.
       //
       // Business rule (2026-09-19, product-confirmed): this table is
       // PROVIDER-PROCESSED GROSS TRANSACTION VOLUME, not SAFAAR's current
       // net cash position. `expected` = provider lifecycle volume that
       // should exist; `actual` = what the provider really processed.
       // Refunds/reversals are separate financial events (tracked in
       // getFinanceOverview().totalRefunds) that do NOT edit this table's
       // history of what was processed.
       //
       // `pending`/`awaiting_cash`/`processing` — not yet collected, still
       // expected (pre-collection states: payments.service.ts creates as
       // pending/awaiting_cash, `prepare` event -> processing, then -> paid).
       //
       // `paid`/`refunded`/`reversed` — the underlying provider transaction
       // WAS processed (refunded/reversed both require a prior real
       // paid/processing state — see admin.service.ts refundApprove() and
       // payments.service.ts uzumReverse()), so it counts as both expected
       // and actual using the original payments.amount (gross) — never
       // refunds.approved_amount (that's a separate, possibly-partial
       // event, intentionally not looked up here).
       //
       // `failed` — that specific attempt never collected anything —
       // excluded from both.
       if (status === 'paid' || status === 'refunded' || status === 'reversed') {
         providerMap[provider].actual += amount;
         providerMap[provider].expected += amount;
       } else if (status === 'pending' || status === 'awaiting_cash' || status === 'processing') {
         providerMap[provider].expected += amount;
       }
    }
    
    return Object.entries(providerMap).map(([provider, amounts]) => ({
      provider,
      expectedAmount: amounts.expected,
      actualAmount: amounts.actual,
      difference: amounts.expected - amounts.actual,
      status: amounts.expected === amounts.actual ? 'matched' : 'mismatched',
      lastSyncedAt: amounts.lastSync,
    }));
  },

  exportFinance: async (filters?: Record<string, unknown>): Promise<{ url: string }> => {
    const { data } = await apiClient.post('/admin/finance/export', filters);
    const r = asRecord(data);
    return { url: asString(r.url) };
  },

  exportTaxReport: async (filters?: Record<string, unknown>): Promise<{ url: string }> => {
    const { data } = await apiClient.post('/admin/finance/tax-report-export', filters);
    const r = asRecord(data);
    return { url: asString(r.url) };
  },

  getFinanceDocuments: async (): Promise<FinanceDocument[]> => {
    const { data } = await apiClient.get('/admin/finance/documents');
    return unknownItems(data).map((row) => {
      const r = asRecord(row);
      const docType = asString(r.type);
      const docStatus = asString(r.status);
      return {
        id: asString(r.id),
        type: (['invoice','tax_report','act'] as const).includes(docType as FinanceDocument['type'])
          ? (docType as FinanceDocument['type'])
          : 'invoice',
        title: asString(r.title, 'Hujjat'),
        partnerName: r.partner_name ? asString(r.partner_name) : undefined,
        period: asString(r.period, '—'),
        url: asString(r.url),
        status: (['generated','failed','pending'] as const).includes(docStatus as FinanceDocument['status'])
          ? (docStatus as FinanceDocument['status'])
          : 'pending',
        createdAt: asString(r.created_at ?? r.createdAt, new Date().toISOString()),
      } satisfies FinanceDocument;
    });
  },

  regenerateFinanceDocument: async (id: string): Promise<FinanceDocument> => {
    const { data } = await apiClient.post(`/admin/finance/documents/${id}/regenerate`);
    const r = asRecord(data);
    const docType = asString(r.type);
    const docStatus = asString(r.status);
    return {
      id: asString(r.id),
      type: (['invoice','tax_report','act'] as const).includes(docType as FinanceDocument['type'])
        ? (docType as FinanceDocument['type'])
        : 'invoice',
      title: asString(r.title, 'Hujjat'),
      partnerName: r.partner_name ? asString(r.partner_name) : undefined,
      period: asString(r.period, '—'),
      url: asString(r.url),
      status: (['generated','failed','pending'] as const).includes(docStatus as FinanceDocument['status'])
        ? (docStatus as FinanceDocument['status'])
        : 'pending',
      createdAt: asString(r.created_at ?? r.createdAt, new Date().toISOString()),
    } satisfies FinanceDocument;
  },

  // Payments
  getPayments: async (): Promise<AdminPaymentTransaction[]> => {
    const { data } = await apiClient.get('/admin/payments');
    return unknownItems(data).map((row) => toPaymentTransaction(asRecord(row)));
  },
  
  reconcilePayment: async (id: string): Promise<AdminPaymentTransaction> => {
    const { data } = await apiClient.post(`/admin/payments/${id}/reconcile`);
    return toPaymentTransaction(asRecord(data));
  },
  
  // Refunds
  getRefunds: async (): Promise<AdminRefundTransaction[]> => {
    const { data } = await apiClient.get('/admin/refunds');
    return unknownItems(data).map((row) => toRefundTransaction(asRecord(row)));
  },
  
  refundAction: async (id: string, action: 'approve' | 'reject' | 'retry'): Promise<AdminRefundTransaction> => {
    const { data } = await apiClient.post(`/admin/refunds/${id}/${action}`);
    return toRefundTransaction(asRecord(data));
  },

  getSettings: async (): Promise<AdminSettings> => {
    const { data } = await apiClient.get('/admin/settings');
    return {
      commissionRate: String(
        data.finance?.hotel_commission_rate ??
          data.general?.hotel_commission_rate ??
          15,
      ),
      busCommissionRate: String(
        data.finance?.bus_commission_rate ??
          data.general?.bus_commission_rate ??
          10,
      ),
      maintenanceMode: Boolean(
        data.general?.maintenance_mode ?? data.maintenance_mode ?? false,
      ),
      contactEmail: String(
        data.general?.support_email ??
          data.support?.email ??
          data.support_email ??
          'support@safaar.uz',
      ),
    };
  },

  updateSettings: async (settings: AdminSettings) => {
    const [general, finance] = await Promise.all([
      apiClient.patch('/admin/settings/general', {
        support_email: settings.contactEmail,
        maintenance_mode: settings.maintenanceMode,
      }),
      apiClient.patch('/admin/settings/finance', {
        hotel_commission_rate: Number(settings.commissionRate),
        bus_commission_rate: Number(settings.busCommissionRate),
      }),
    ]);

    return { general: general.data, finance: finance.data };
  },

  updateGeneralSettings: async (
    settings: Pick<AdminSettings, 'contactEmail' | 'maintenanceMode'>,
  ) => {
    const { data } = await apiClient.patch('/admin/settings/general', {
      support_email: settings.contactEmail,
      maintenance_mode: settings.maintenanceMode,
    });
    return data;
  },

  // Finance
  getWithdrawals: async (): Promise<WithdrawalRequest[]> => {
    const { data } = await apiClient.get('/admin/withdrawals');
    return unknownItems(data).map((row) => toWithdrawal(asRecord(row)));
  },

  approveWithdrawal: async (id: string): Promise<WithdrawalRequest> => {
    const { data } = await apiClient.post(`/admin/withdrawals/${id}/approve`);
    return toWithdrawal(asRecord(data));
  },

  rejectWithdrawal: async (id: string): Promise<WithdrawalRequest> => {
    const { data } = await apiClient.post(`/admin/withdrawals/${id}/reject`);
    return toWithdrawal(asRecord(data));
  },

  markWithdrawalPaid: async (id: string): Promise<WithdrawalRequest> => {
    const { data } = await apiClient.post(`/admin/withdrawals/${id}/mark-paid`);
    return toWithdrawal(asRecord(data));
  },

  getFinanceReports: async (): Promise<FinanceReport[]> => {
    const { data } = await apiClient.get('/admin/finance/partners-report');
    return unknownItems(data).map((row, index) =>
      toFinanceReport(asRecord(row), index),
    );
  },

  // Uploads — real backend media store (Cloudflare R2 / local fallback,
  // apps/backend/src/uploads/), the same endpoint web-partner already
  // uses (see app/_lib/api/endpoints/partners.ts uploadImage). Content-Type
  // is unset so the browser fills in the multipart boundary itself.
  uploadImage: async (file: File): Promise<{ id: string; url: string }> => {
    const formData = new FormData();
    formData.set('file', file);
    const { data } = await apiClient.post('/uploads/images', formData, {
      headers: { 'Content-Type': undefined },
    });
    return { id: asString(data.id), url: asString(data.url) };
  },

  // CMS
  getCmsBanners: async (): Promise<CmsBanner[]> => {
    const { data } = await apiClient.get('/admin/cms/banners');
    return unknownItems(data).map((row) => toCmsBanner(asRecord(row)));
  },
  getCmsNews: async (): Promise<CmsArticle[]> => {
    const { data } = await apiClient.get('/admin/cms/news');
    return unknownItems(data).map((row) => toCmsArticle(asRecord(row), 'news'));
  },
  createCmsNews: async (news: Omit<CmsArticle, 'id'>): Promise<CmsArticle> => {
    const payload = {
      slug: news.slug,
      status: news.status,
      title: { uz: news.title, ru: news.title, en: news.title },
      body: { uz: '', ru: '', en: '' },
      metadata: news.metadata,
    };
    const { data } = await apiClient.post('/admin/cms/news', payload);
    return toCmsArticle(asRecord(data), 'news');
  },
  updateCmsNews: async (
    id: string,
    news: Partial<CmsArticle>,
  ): Promise<CmsArticle> => {
    const payload: any = {};
    if (news.slug !== undefined) payload.slug = news.slug;
    if (news.status !== undefined) payload.status = news.status;
    if (news.title !== undefined) payload.title = { uz: news.title, ru: news.title, en: news.title };
    if (news.metadata !== undefined) payload.metadata = news.metadata;

    const { data } = await apiClient.patch(`/admin/cms/news/${id}`, payload);
    return toCmsArticle(asRecord(data), 'news');
  },
  deleteCmsNews: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/cms/news/${id}`);
  },
  setCmsNewsStatus: async (
    id: string,
    status: 'published' | 'draft',
  ): Promise<CmsArticle> => {
    const action = status === 'published' ? 'publish' : 'unpublish';
    const { data } = await apiClient.post(`/admin/cms/news/${id}/${action}`);
    return toCmsArticle(asRecord(data), 'news');
  },
  getCmsPages: async (): Promise<CmsArticle[]> => {
    const { data } = await apiClient.get('/admin/cms/pages');
    return unknownItems(data).map((row) => toCmsArticle(asRecord(row), 'page'));
  },
  createCmsPage: async (pageItem: Omit<CmsArticle, 'id'>): Promise<CmsArticle> => {
    const payload = {
      slug: pageItem.slug,
      status: pageItem.status,
      title: { uz: pageItem.title, ru: pageItem.title, en: pageItem.title },
      body: { uz: '', ru: '', en: '' },
      metadata: pageItem.metadata,
    };
    const { data } = await apiClient.post('/admin/cms/pages', payload);
    return toCmsArticle(asRecord(data), 'page');
  },
  updateCmsPage: async (
    id: string,
    pageItem: Partial<CmsArticle>,
  ): Promise<CmsArticle> => {
    const payload: any = {};
    if (pageItem.slug !== undefined) payload.slug = pageItem.slug;
    if (pageItem.status !== undefined) payload.status = pageItem.status;
    if (pageItem.title !== undefined) payload.title = { uz: pageItem.title, ru: pageItem.title, en: pageItem.title };
    if (pageItem.metadata !== undefined) payload.metadata = pageItem.metadata;

    const { data } = await apiClient.patch(`/admin/cms/pages/${id}`, payload);
    return toCmsArticle(asRecord(data), 'page');
  },
  deleteCmsPage: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/cms/pages/${id}`);
  },
  setCmsPageStatus: async (
    id: string,
    status: 'published' | 'draft',
  ): Promise<CmsArticle> => {
    const action = status === 'published' ? 'publish' : 'unpublish';
    const { data } = await apiClient.post(`/admin/cms/pages/${id}/${action}`);
    return toCmsArticle(asRecord(data), 'page');
  },
  getCmsOffers: async (): Promise<CmsArticle[]> => {
    const { data } = await apiClient.get('/admin/cms/offers');
    return unknownItems(data).map((row) =>
      toCmsArticle(asRecord(row), 'offer'),
    );
  },
  createCmsOffer: async (
    offer: Omit<CmsArticle, 'id'>,
  ): Promise<CmsArticle> => {
    const payload = {
      slug: offer.slug,
      status: offer.status,
      title: { uz: offer.title, ru: offer.title, en: offer.title },
      body: { uz: '', ru: '', en: '' },
      metadata: offer.metadata,
    };
    const { data } = await apiClient.post('/admin/cms/offers', payload);
    return toCmsArticle(asRecord(data), 'offer');
  },
  updateCmsOffer: async (
    id: string,
    offer: Partial<CmsArticle>,
  ): Promise<CmsArticle> => {
    const payload: any = {};
    if (offer.slug !== undefined) payload.slug = offer.slug;
    if (offer.status !== undefined) payload.status = offer.status;
    if (offer.title !== undefined) payload.title = { uz: offer.title, ru: offer.title, en: offer.title };
    if (offer.metadata !== undefined) payload.metadata = offer.metadata;

    const { data } = await apiClient.patch(`/admin/cms/offers/${id}`, payload);
    return toCmsArticle(asRecord(data), 'offer');
  },
  deleteCmsOffer: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/cms/offers/${id}`);
  },
  setCmsOfferStatus: async (
    id: string,
    status: 'published' | 'draft',
  ): Promise<CmsArticle> => {
    const action = status === 'published' ? 'publish' : 'unpublish';
    const { data } = await apiClient.post(`/admin/cms/offers/${id}/${action}`);
    return toCmsArticle(asRecord(data), 'offer');
  },

  // Destinations (Mashhur yo'nalishlar) — /admin/cms/destinations orqali
  // generik CMS yozuvlari (cms_entries, type='destination'), banners bilan
  // bir xil naqsh (backend hech qanday o'zgarishsiz ishlaydi, chunki
  // cmsTypesForResource 'destinations' -> 'destination'ni avtomatik chiqaradi).
  getCmsDestinations: async (): Promise<CmsDestination[]> => {
    const { data } = await apiClient.get('/admin/cms/destinations');
    return unknownItems(data)
      .map((row) => toCmsDestination(asRecord(row)))
      .sort((a, b) => a.order - b.order);
  },

  createCmsDestination: async (
    destination: Omit<CmsDestination, 'id'>,
  ): Promise<CmsDestination> => {
    const { data } = await apiClient.post(
      '/admin/cms/destinations',
      cmsDestinationPayload(destination),
    );
    if (destination.isActive) {
      await apiClient.post(`/admin/cms/destinations/${data.id}/publish`);
      return AdminApi.getCmsDestinations().then(
        (destinations) =>
          destinations.find((item) => item.id === data.id) ??
          toCmsDestination(asRecord(data)),
      );
    }
    return toCmsDestination(asRecord(data));
  },

  updateCmsDestination: async (
    id: string,
    destination: Partial<CmsDestination>,
  ): Promise<CmsDestination> => {
    const { data } = await apiClient.patch(
      `/admin/cms/destinations/${id}`,
      cmsDestinationPayload(destination),
    );
    if (typeof destination.isActive === 'boolean') {
      const action = await apiClient.post(
        `/admin/cms/destinations/${id}/${destination.isActive ? 'publish' : 'unpublish'}`,
      );
      return toCmsDestination(asRecord(action.data));
    }
    return toCmsDestination(asRecord(data));
  },

  deleteCmsDestination: async (id: string): Promise<void> => {
    await apiClient.post(`/admin/cms/destinations/${id}/archive`);
  },

  setCmsDestinationStatus: async (
    id: string,
    isActive: boolean,
  ): Promise<CmsDestination> => {
    const { data } = await apiClient.post(
      `/admin/cms/destinations/${id}/${isActive ? 'publish' : 'unpublish'}`,
    );
    return toCmsDestination(asRecord(data));
  },
  createCmsBanner: async (
    banner: Omit<CmsBanner, 'id'>,
  ): Promise<CmsBanner> => {
    const { data } = await apiClient.post(
      '/admin/cms/banners',
      cmsBannerPayload(banner),
    );
    if (banner.isActive) {
      await apiClient.post(`/admin/cms/banners/${data.id}/publish`);
      return AdminApi.getCmsBanners().then(
        (banners) =>
          banners.find((item) => item.id === data.id) ??
          toCmsBanner(asRecord(data)),
      );
    }
    return toCmsBanner(asRecord(data));
  },
  updateCmsBanner: async (
    id: string,
    banner: Partial<CmsBanner>,
  ): Promise<CmsBanner> => {
    const { data } = await apiClient.patch(
      `/admin/cms/banners/${id}`,
      cmsBannerPayload(banner),
    );
    if (typeof banner.isActive === 'boolean') {
      const action = await apiClient.post(
        `/admin/cms/banners/${id}/${banner.isActive ? 'publish' : 'unpublish'}`,
      );
      return toCmsBanner(asRecord(action.data));
    }
    return toCmsBanner(asRecord(data));
  },
  setCmsBannerActive: async (
    id: string,
    isActive: boolean,
  ): Promise<CmsBanner> => {
    const { data } = await apiClient.post(
      `/admin/cms/banners/${id}/${isActive ? 'publish' : 'unpublish'}`,
    );
    return toCmsBanner(asRecord(data));
  },
  deleteCmsBanner: async (id: string): Promise<void> => {
    await apiClient.post(`/admin/cms/banners/${id}/archive`);
  },

  // Catalog
  getRegions: async (): Promise<CatalogRegion[]> => {
    const { data } = await apiClient.get('/catalog/regions');
    return unknownItems(data).map((row) => toRegion(asRecord(row)));
  },
  createRegion: async (name: string): Promise<CatalogRegion> => {
    const { data } = await apiClient.post('/admin/catalog/regions', { name });
    return toRegion(asRecord(data));
  },
  updateRegion: async (id: string, name: string): Promise<CatalogRegion> => {
    const { data } = await apiClient.patch(`/admin/catalog/regions/${id}`, { name });
    return toRegion(asRecord(data));
  },
  deleteRegion: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/catalog/regions/${id}`);
  },
  getAmenities: async (): Promise<CatalogAmenity[]> => {
    const { data } = await apiClient.get('/catalog/amenities');
    return unknownItems(data).map((row) => toAmenity(asRecord(row)));
  },
  createAmenity: async (code: string, name: string): Promise<CatalogAmenity> => {
    const { data } = await apiClient.post('/admin/catalog/amenities', { code, name });
    return toAmenity(asRecord(data));
  },
  updateAmenity: async (id: string, name: string): Promise<CatalogAmenity> => {
    const { data } = await apiClient.patch(`/admin/catalog/amenities/${id}`, { name });
    return toAmenity(asRecord(data));
  },
  deleteAmenity: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/catalog/amenities/${id}`);
  },

  // Promos
  getPromos: async (): Promise<PromoCode[]> => {
    const { data } = await apiClient.get('/admin/promos');
    return unknownItems(data).map((row) => toPromo(asRecord(row)));
  },
  createPromo: async (input: {
    code: string;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    usageLimit: number;
    validUntil?: string;
  }): Promise<void> => {
    // Backend `POST /admin/promos` javobi cms_entries'ning xom
    // (title/metadata) shaklida qaytadi — `getPromos()` esa alohida,
    // tekislangan SQL proyeksiyasidan o'qiydi. Shu farq tufayli ro'yxatni
    // yaratishdan keyin qayta yuklab olish kerak (bu funksiya faqat POST
    // qiladi, chaqiruvchi keyin `getPromos()`ni qayta chaqiradi).
    await apiClient.post('/admin/promos', {
      code: input.code,
      discountType: input.discountType === 'percent' ? 'percentage' : 'fixed',
      discountValue: input.discountValue,
      usageLimit: input.usageLimit,
      validUntil: input.validUntil || undefined,
    });
  },
  updatePromo: async (
    id: string,
    input: {
      code: string;
      discountType: 'percent' | 'fixed';
      discountValue: number;
      usageLimit: number;
      validUntil?: string;
      isActive: boolean;
    },
  ): Promise<void> => {
    await apiClient.patch(`/admin/promos/${id}`, {
      code: input.code,
      discountType: input.discountType === 'percent' ? 'percentage' : 'fixed',
      discountValue: input.discountValue,
      usageLimit: input.usageLimit,
      validUntil: input.validUntil || undefined,
      isActive: input.isActive,
    });
  },
  deletePromo: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/promos/${id}`);
  },

  // Support
  getTickets: async (): Promise<SupportTicket[]> => {
    const { data } = await apiClient.get('/admin/support/tickets');
    return unknownItems(data).map((row) => toSupportTicket(asRecord(row)));
  },
  getTicketMessages: async (ticketId: string): Promise<TicketMessage[]> => {
    const { data } = await apiClient.get(`/admin/support/tickets/${ticketId}`);
    return unknownItems(data.messages).map((row) =>
      toTicketMessage(asRecord(row)),
    );
  },
  sendMessage: async (
    ticketId: string,
    message: string,
  ): Promise<TicketMessage> => {
    const { data } = await apiClient.post(
      `/admin/support/tickets/${ticketId}/messages`,
      {
        message,
      },
    );
    return toTicketMessage(asRecord(data));
  },
  updateTicketStatus: async (
    ticketId: string,
    status: string,
  ): Promise<void> => {
    await apiClient.patch(`/admin/support/tickets/${ticketId}/status`, {
      status,
    });
  },

  // Listings (Hotels moderation)
  getListings: async (): Promise<AdminListing[]> => {
    const { data } = await apiClient.get('/admin/hotels');
    return unknownItems(data).map((row) => toListing(asRecord(row)));
  },

  getListing: async (id: string): Promise<AdminListing> => {
    const { data } = await apiClient.get(`/admin/hotels/${id}`);
    return toListing(asRecord(data));
  },

  approveListing: async (id: string) => {
    const { data } = await apiClient.post(`/admin/hotels/${id}/publish`);
    return data;
  },

  rejectListing: async (id: string, reason?: string) => {
    const { data } = await apiClient.post(`/admin/hotels/${id}/reject`, {
      reason: reason ?? '',
    });
    return data;
  },

  updateListing: async (id: string, payload: Partial<AdminListing>): Promise<AdminListing> => {
    const { data } = await apiClient.patch(`/admin/hotels/${id}`, payload);
    return toListing(asRecord(data));
  },

  // ── Availability (2026-09-14 gap closure) ───────────────────────────
  // Backend: GET/POST/DELETE /admin/rooms/:id/... (admin.controller.ts,
  // roomAvailabilityCalendar/Block/Unblock in admin.service.ts) — reuses
  // the existing `room_inventory` table, no mock.
  getRoomAvailability: async (
    roomId: string,
    from: string,
    to: string,
  ): Promise<RoomAvailability> => {
    const { data } = await apiClient.get(`/admin/rooms/${roomId}/availability`, {
      params: { from, to },
    });
    const row = asRecord(data);
    const rawDays = Array.isArray(row.days) ? row.days : [];
    return {
      roomId: asString(row.room_id, roomId),
      hotelId: asString(row.hotel_id),
      totalInventory: asNumber(row.total_inventory),
      days: rawDays.map((rawDay): AvailabilityDay => {
        const day = asRecord(rawDay);
        const status = asString(day.status, 'available');
        return {
          date: asString(day.date),
          totalCount: asNumber(day.total_count),
          bookedCount: asNumber(day.booked_count),
          blocked: Boolean(day.blocked),
          status: (['available', 'booked', 'blocked', 'partially_occupied'].includes(
            status,
          )
            ? status
            : 'available') as AvailabilityDayStatus,
          sellableCount: asNumber(day.sellable_count),
        };
      }),
    };
  },

  blockRoomAvailability: async (
    roomId: string,
    startDate: string,
    endDate: string,
    reason: string,
  ) => {
    const { data } = await apiClient.post(`/admin/rooms/${roomId}/block`, {
      start_date: startDate,
      end_date: endDate,
      reason,
    });
    return data;
  },

  unblockRoomAvailability: async (
    roomId: string,
    startDate: string,
    endDate: string,
  ) => {
    const { data } = await apiClient.delete(`/admin/rooms/${roomId}/block`, {
      data: { start_date: startDate, end_date: endDate },
    });
    return data;
  },

  // ── Reviews (2026-09-14 gap closure) ────────────────────────────────
  getReviews: async (filters?: {
    status?: AdminReviewStatus | '';
    targetType?: string;
    minRating?: number;
  }): Promise<AdminReview[]> => {
    const { data } = await apiClient.get('/admin/reviews', {
      params: {
        status: filters?.status || undefined,
        target_type: filters?.targetType || undefined,
        min_rating: filters?.minRating || undefined,
      },
    });
    return unknownItems(data).map((row) => toReview(asRecord(row)));
  },

  // Backend returns only {id, status, updated_at} (not a full review row) —
  // typed narrowly here so callers don't mistake this for the complete
  // AdminReview shape and accidentally overwrite good fields with defaults.
  publishReview: async (
    id: string,
  ): Promise<{ id: string; status: AdminReviewStatus }> => {
    const { data } = await apiClient.post(`/admin/reviews/${id}/publish`);
    const row = asRecord(data);
    return { id: asString(row.id, id), status: 'published' };
  },

  hideReview: async (
    id: string,
  ): Promise<{ id: string; status: AdminReviewStatus }> => {
    const { data } = await apiClient.post(`/admin/reviews/${id}/hide`);
    const row = asRecord(data);
    return { id: asString(row.id, id), status: 'hidden' };
  },

  // ── Generic CMS entries (2026-09-14 gap closure — Translations/SEO) ──
  // Reuses the EXISTING generic /admin/cms/:resource[/:id] backend
  // (title/body Json + metadata Json, cmsList/cmsOne/cmsUpdate) — same
  // data the resource-specific banners/news/pages/offers pages already
  // read, just kept in its full {uz,ru,en} shape instead of flattened.
  getCmsEntries: async (resource: string): Promise<CmsEntry[]> => {
    const { data } = await apiClient.get(`/admin/cms/${resource}`);
    return unknownItems(data).map((row) => toCmsEntry(asRecord(row)));
  },

  updateCmsEntryTranslations: async (
    resource: string,
    id: string,
    title: Record<string, string>,
    body: Record<string, string>,
  ): Promise<CmsEntry> => {
    const { data } = await apiClient.patch(`/admin/cms/${resource}/${id}`, {
      title,
      body,
    });
    return toCmsEntry(asRecord(data));
  },

  updateCmsEntrySeo: async (
    resource: string,
    id: string,
    seo: CmsEntrySeo,
  ): Promise<CmsEntry> => {
    const { data } = await apiClient.patch(`/admin/cms/${resource}/${id}`, {
      metadata: { seo },
    });
    return toCmsEntry(asRecord(data));
  },

  // develop (ce07fc27) independently added mocked getReviews/updateReviewStatus/
  // deleteReview, getTranslations/createTranslation/updateTranslation/
  // deleteTranslation and getSeoSettings/updateSeoSetting — all explicitly
  // labeled "MOCKED - BACKEND ENDPOINT YETISHMAYDI". Dropped in favor of
  // the real, backend-connected getReviews/publishReview/hideReview and
  // getCmsEntries/updateCmsEntryTranslations/updateCmsEntrySeo above
  // (verified live against the QA backend this session).
  //
  // 2026-09-24: real backend (commit b7ee632d) — GET /admin/promotions,
  // POST /admin/promotions/:id/approve|reject. Field names already match
  // `PartnerPromotion` exactly (see backend's `toPromotionApiShape()`).
  getPartnerPromotions: async (): Promise<PartnerPromotion[]> => {
    const { data } = await apiClient.get('/admin/promotions');
    return unknownItems(data).map((row) => toPartnerPromotion(asRecord(row)));
  },

  approvePartnerPromotion: async (id: string): Promise<PartnerPromotion> => {
    const { data } = await apiClient.post(`/admin/promotions/${id}/approve`);
    return toPartnerPromotion(asRecord(data));
  },

  rejectPartnerPromotion: async (id: string): Promise<PartnerPromotion> => {
    const { data } = await apiClient.post(`/admin/promotions/${id}/reject`);
    return toPartnerPromotion(asRecord(data));
  },

  toggleListingFeatured: async (
    id: string,
    featured: boolean,
  ): Promise<{ id: string; featured: boolean; featured_order: number | null }> => {
    const { data } = await apiClient.patch(`/admin/hotels/${id}/featured`, { featured });
    return data;
  },

  // `orderedIds` — final display order. The server derives the actual
  // `featured_order` values from array position; it never trusts a
  // client-supplied number, and rejects any ID that isn't an existing,
  // currently-featured hotel.
  reorderFeaturedListings: async (orderedIds: string[]): Promise<{ updated: number }> => {
    const { data } = await apiClient.post('/admin/hotels/featured/reorder', { orderedIds });
    return data;
  },

  blockListingDates: async (id: string, payload: { startDate: string; endDate: string; reason: string }) => {
    const { data } = await apiClient.post(`/admin/hotels/${id}/blocked-dates`, payload);
    return data;
  },
};
