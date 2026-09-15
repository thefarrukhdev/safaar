import { rawApi } from '../client';
import { camelizeKeys } from '../case';
import { toBookingView } from '../adapters';
import type { BookingView } from '../types';

export interface CreateHotelBookingInput {
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  paymentMethod?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  slotTime?: string;
  totalPrice?: number;
  source?: string;
  /** Backend tomonidan MAJBURIY tekshiriladi (`true` bo'lmasa
   * `TERMS_NOT_ACCEPTED` bilan rad etiladi) — checkout uchun. */
  agreeTerms: boolean;
}

export interface CreateBusBookingInput {
  tripId: string;
  seats: string[];
  paymentMethod?: string;
}

export interface CreateVehicleRentalInput {
  vehicleId: string;
  checkIn: string;
  checkOut: string;
  paymentMethod?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  promoCode?: string;
}

export const bookingsService = {
  /** `POST /bookings/hotel` — mehmonxona broni yaratish. */
  async createHotelBooking(
    input: CreateHotelBookingInput,
    options?: { token?: string },
  ): Promise<BookingView & { guestAccessToken?: string }> {
    const fullName =
      input.fullName ??
      [input.firstName, input.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
    const guestName = input.guestName ?? fullName;
    const guestEmail = input.guestEmail ?? input.email;
    const guestPhone = input.guestPhone ?? input.phone;

    const raw = await rawApi.post<unknown>(
      '/bookings/hotel',
      {
        hotel_id: input.hotelId,
        room_id: input.roomId,
        check_in: input.checkIn,
        check_out: input.checkOut,
        rooms: 1,
        adults: input.guests ?? 1,
        payment_method: input.paymentMethod ?? 'click',
        firstName: input.firstName,
        lastName: input.lastName,
        fullName,
        email: input.email,
        phone: input.phone,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        slot_time: input.slotTime,
        total_price: input.totalPrice,
        source: input.source,
        agree_terms: input.agreeTerms,
      },
      options,
    );
    const camelized = camelizeKeys<Parameters<typeof toBookingView>[0]>(raw);
    const guestAccessToken = (camelized as { guestAccessToken?: string })
      .guestAccessToken;
    return { ...toBookingView(camelized), guestAccessToken };
  },

  /**
   * `GET /bookings/:id` — bron tafsiloti. Login qilingan user/partner/admin
   * uchun `token` orqali; guest (login qilmagan) checkout uchun — booking
   * yaratishda qaytarilgan opaque `guestAccessToken` orqali (faqat AYNAN
   * shu bronga bog'langan, boshqa bronni ochish uchun ishlamaydi).
   */
  async getBooking(
    id: string,
    options?: { token?: string; guestToken?: string },
  ): Promise<BookingView> {
    const raw = await rawApi.get<unknown>(`/bookings/${encodeURIComponent(id)}`, {
      token: options?.token,
      query: options?.guestToken ? { guestToken: options.guestToken } : undefined,
    });
    return toBookingView(camelizeKeys(raw));
  },

  /**
   * `POST /bookings/lookup` — login qilmagan (guest) mijoz o'z bronini
   * (masalan keyinroq, boshqa qurilmadan) bron raqami + email juftligi
   * orqali qidiradi — o'zi yaratgan darhol tasdiqlash sahifasi UCHUN emas
   * (buning uchun `guestAccessToken` ishlatiladi), balki "broningizni
   * toping" ko'rinishidagi keyingi, sovuq (cold) qidiruv uchun.
   */
  async lookupBooking(
    bookingNumber: string,
    email: string,
  ): Promise<BookingView> {
    const raw = await rawApi.post<unknown>(
      '/bookings/lookup',
      { booking_number: bookingNumber, email },
    );
    return toBookingView(camelizeKeys(raw));
  },

  /** `POST /bookings/bus` — avtobus broni yaratish. */
  async createBusBooking(
    input: CreateBusBookingInput,
    options?: { token?: string },
  ): Promise<BookingView> {
    const raw = await rawApi.post<unknown>(
      '/bookings/bus',
      {
        trip_id: input.tripId,
        seats: input.seats,
        payment_method: input.paymentMethod ?? 'click',
      },
      options,
    );
    return toBookingView(camelizeKeys(raw));
  },

  /** `POST /bookings/vehicle` — mashina ijarasi (rent-a-car) broni yaratish. */
  async createVehicleBooking(
    input: CreateVehicleRentalInput,
    options?: { token?: string },
  ): Promise<BookingView> {
    const fullName =
      input.fullName ??
      [input.firstName, input.lastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(' ');
    const guestName = input.guestName ?? fullName;
    const guestEmail = input.guestEmail ?? input.email;
    const guestPhone = input.guestPhone ?? input.phone;

    const raw = await rawApi.post<unknown>(
      '/bookings/vehicle',
      {
        vehicle_id: input.vehicleId,
        check_in: input.checkIn,
        check_out: input.checkOut,
        payment_method: input.paymentMethod ?? 'click',
        firstName: input.firstName,
        lastName: input.lastName,
        fullName,
        email: input.email,
        phone: input.phone,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        promo_code: input.promoCode,
      },
      options,
    );
    return toBookingView(camelizeKeys(raw));
  },

  /** `POST /bookings/:id/cancel-preview` — bekor qilish jarimasini hisoblash. */
  async cancelPreview(id: string, options?: { token?: string }): Promise<any> {
    return rawApi.post<any>(`/bookings/${encodeURIComponent(id)}/cancel-preview`, {}, options);
  },

  /** `POST /bookings/:id/cancel` — bronni bekor qilish. */
  async cancelBooking(id: string, reason?: string, options?: { token?: string }): Promise<BookingView> {
    const raw = await rawApi.post<unknown>(
      `/bookings/${encodeURIComponent(id)}/cancel`,
      { reason },
      options,
    );
    return toBookingView(camelizeKeys(raw));
  },

  /** `GET /bookings/:id/messages` — chat xabarlari. */
  async getMessages(id: string, options?: { token?: string }): Promise<any[]> {
    return rawApi.get<any[]>(`/bookings/${encodeURIComponent(id)}/messages`, options);
  },

  /** `POST /bookings/:id/messages` — chatga xabar yuborish. */
  async sendMessage(id: string, body: string, options?: { token?: string }): Promise<any> {
    return rawApi.post<any>(
      `/bookings/${encodeURIComponent(id)}/messages`,
      { body },
      options,
    );
  },
};
