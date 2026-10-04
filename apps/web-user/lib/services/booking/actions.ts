"use server";

import { redirect } from "next/navigation";
import { api, ApiRequestError } from "@/lib/api";
import { clearSession, getSession } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/i18n/config";

const SESSION_EXPIRED_CODES = new Set([
  "AUTH_TOKEN_INVALID",
  "AUTH_SESSION_REVOKED",
]);

async function redirectToLoginIfSessionExpired(
  error: unknown,
  locale: string,
): Promise<void> {
  if (
    error instanceof ApiRequestError &&
    (error.statusCode === 401 ||
      (error.code && SESSION_EXPIRED_CODES.has(error.code)))
  ) {
    await clearSession();
    redirect(`/${locale}/login?next=/${locale}/booking&reason=session_expired`);
  }
}

export interface CheckoutState {
  error?: string;
}

export async function createBookingAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const session = await getSession();

  const rawPaymentMethod = String(formData.get("paymentMethod") ?? "uzcard");
  const paymentMethod = (rawPaymentMethod === "card" ? "uzcard" : rawPaymentMethod) as
    | "uzcard"
    | "humo"
    | "visa"
    | "mastercard"
    | "cash";
  // HTML checkboxlar FAQAT belgilangan holatda FormData'ga tushadi —
  // mavjudligi checked holatini bildiradi. Client checkboxning o'zi
  // source of truth emas: backend `agree_terms`ni qat'iy qayta tekshiradi
  // (`TERMS_NOT_ACCEPTED` bilan rad etadi) — shu yerdagi tekshiruv faqat
  // tezroq, aniqroq xabar berish uchun.
  const agreeTerms = formData.get("agreeTerms") != null;
  if (!agreeTerms) {
    return { error: "TERMS_NOT_ACCEPTED" };
  }
  const input = {
    hotelId: String(formData.get("hotelId") ?? ""),
    roomId: String(formData.get("roomId") ?? ""),
    checkIn: String(formData.get("checkIn") ?? ""),
    checkOut: String(formData.get("checkOut") ?? ""),
    guests: Number(formData.get("guests") ?? 1),
    paymentMethod,
    firstName: formData.get("firstName") ? String(formData.get("firstName")) : undefined,
    lastName: formData.get("lastName") ? String(formData.get("lastName")) : undefined,
    email: formData.get("email") ? String(formData.get("email")) : undefined,
    phone: formData.get("phone") ? String(formData.get("phone")) : undefined,
    specialRequests: formData.get("specialRequests") ? String(formData.get("specialRequests")) : undefined,
    promoCode: formData.get("promoCode") ? String(formData.get("promoCode")) : undefined,
    agreeTerms,
  };
  let bookingId = "";
  let guestAccessTokenParam = "";

  try {
    const booking = await api.bookings.createHotelBooking(input, { token: session?.accessToken });
    bookingId = booking.id;
    // Guest (login qilmagan) checkout uchun backend opaque guest-access
    // token qaytaradi — u bo'lmasa, keyingi `/booking/:id` yuklanishida
    // GET so'rovi rad etiladi (guest'ning o'z sessiyasi yo'q). Login
    // qilingan foydalanuvchi uchun bu maydon yo'q (kerak ham emas).
    guestAccessTokenParam = booking.guestAccessToken
      ? `&guestToken=${encodeURIComponent(booking.guestAccessToken)}`
      : "";
  } catch (error) {
    await redirectToLoginIfSessionExpired(error, locale);
    return {
      error: error instanceof ApiRequestError ? error.message : "ERROR",
    };
  }

  if (paymentMethod === "cash") {
    redirect(`/${locale}/booking/${bookingId}?status=confirmed&payment=${paymentMethod}${guestAccessTokenParam}`);
  }

  // MUHIM: bu yerdan endi Click/Payme checkoutiga TO'G'RIDAN-TO'G'RI
  // o'tilmaydi — booking allaqachon o'zining "qoralama" to'lov qatoriga
  // ega (backend, booking yaratishning bir qismi sifatida). Foydalanuvchi
  // booking detail sahifasiga o'tkaziladi — u yerda to'lov usuli/fee/
  // yakuniy summa aniq ko'rsatiladi (RetryPaymentForm), va HAQIQIY
  // provider checkoutiga o'tish FAQAT foydalanuvchi buni ko'rib, aniq
  // tasdiqlagandan keyin sodir bo'ladi.
  redirect(`/${locale}/booking/${bookingId}?payment=pending&provider=${paymentMethod}${guestAccessTokenParam}`);
}


export interface BusCheckoutState {
  error?: string;
}

export async function createBusBookingAction(
  _prev: BusCheckoutState,
  formData: FormData,
): Promise<BusCheckoutState> {
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const tripId = String(formData.get("tripId") ?? "");
  const seats = String(formData.get("seats") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const rawPaymentMethod = String(formData.get("paymentMethod") ?? "uzcard");
  const paymentMethod = (rawPaymentMethod === "card" ? "uzcard" : rawPaymentMethod) as
    | "uzcard"
    | "humo"
    | "visa"
    | "mastercard"
    | "cash";

  if (!tripId || seats.length === 0) {
    return { error: "NO_SEATS" };
  }

  let bookingId = "";
  try {
    const booking = await api.bookings.createBusBooking({
      tripId,
      seats,
      paymentMethod,
    }, { token: session.accessToken });
    bookingId = booking.id;
  } catch (error) {
    await redirectToLoginIfSessionExpired(error, locale);
    return {
      error: error instanceof ApiRequestError ? error.message : "ERROR",
    };
  }

  if (paymentMethod === "cash") {
    redirect(`/${locale}/booking/${bookingId}?status=confirmed&payment=cash`);
  }

  // Hotel oqimidagi bilan bir xil tuzatish: to'g'ridan-to'g'ri provider
  // checkoutiga EMAS, booking detail sahifasiga (fee/yakuniy summa
  // ko'rsatilib, foydalanuvchi tasdiqlagach checkoutga o'tadi).
  redirect(`/${locale}/booking/${bookingId}?payment=pending&provider=${paymentMethod}`);
}

export async function validatePromoAction(
  code: string,
  roomId?: string,
  vehicleId?: string
) {
  try {
    const res = await api.promos.validate(code, roomId, vehicleId);
    return { success: true, data: res };
  } catch (error) {
    return {
      success: false,
      error: error instanceof ApiRequestError ? (error.message || error.code || "Xato yuz berdi") : "Tizim xatosi",
    };
  }
}

export async function createRestaurantBookingAction(input: {
  restaurantId: string;
  tableId: string;
  date: string;
  slotTime: string;
  guests: number;
  totalPrice: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  paymentMethod: "uzcard" | "humo" | "visa" | "mastercard" | "cash";
  agreeTerms: boolean;
}): Promise<{
  ok: boolean;
  bookingId?: string;
  bookingNumber?: string;
  guestAccessToken?: string;
  requiresOtp?: boolean;
  maskedPhone?: string;
  expiresIn?: number;
  error?: string;
}> {
  if (!input.agreeTerms) {
    return { ok: false, error: "TERMS_NOT_ACCEPTED" };
  }

  const session = await getSession();

  try {
    const booking = await api.bookings.createHotelBooking(
      {
        hotelId: input.restaurantId,
        roomId: input.tableId || input.restaurantId,
        checkIn: input.date,
        checkOut: input.date,
        slotTime: input.slotTime,
        guests: input.guests,
        totalPrice: input.totalPrice,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        source: "web-user",
        paymentMethod: input.paymentMethod,
        agreeTerms: input.agreeTerms,
      },
      session ? { token: session.accessToken } : undefined
    );

    return {
      ok: true,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      guestAccessToken: booking.guestAccessToken,
      requiresOtp: (booking as { requires_otp?: boolean }).requires_otp,
      maskedPhone: (booking as { masked_phone?: string }).masked_phone,
      expiresIn: (booking as { expires_in?: number }).expires_in,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof ApiRequestError ? (err.code || err.message) : "Xatolik yuz berdi",
    };
  }
}

export async function createHotelBookingDirectAction(input: {
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  paymentMethod: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  specialRequests?: string;
  promoCode?: string;
  agreeTerms: boolean;
  locale: string;
}): Promise<{
  ok: boolean;
  bookingId?: string;
  guestAccessToken?: string;
  requiresOtp?: boolean;
  maskedPhone?: string;
  expiresIn?: number;
  error?: string;
}> {
  if (!input.agreeTerms) {
    return { ok: false, error: "TERMS_NOT_ACCEPTED" };
  }

  const session = await getSession();

  try {
    const requestData = {
      hotelId: input.hotelId,
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      paymentMethod: input.paymentMethod,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email,
      specialRequests: input.specialRequests,
      promoCode: input.promoCode,
      agreeTerms: input.agreeTerms,
      source: "web-user",
    };

    const booking = await api.bookings.createHotelBooking(
      requestData,
      session ? { token: session.accessToken } : undefined
    );

    return {
      ok: true,
      bookingId: booking.id,
      guestAccessToken: booking.guestAccessToken,
      requiresOtp: (booking as { requires_otp?: boolean }).requires_otp,
      maskedPhone: (booking as { masked_phone?: string }).masked_phone,
      expiresIn: (booking as { expires_in?: number }).expires_in,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof ApiRequestError ? (err.code || err.message) : "Xatolik yuz berdi",
    };
  }
}

export async function createVehicleBookingAction(input: {
  vehicleId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  paymentMethod: string;
}) {
  const session = await getSession();

  try {
    const options = session ? { token: session.accessToken } : undefined;
    const booking = await api.bookings.createVehicleBooking(
      {
        vehicleId: input.vehicleId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        paymentMethod: input.paymentMethod,
      },
      options
    );
    return { ok: true, bookingId: booking.bookingNumber || booking.id, guestAccessToken: booking.guestAccessToken };
  } catch (err: unknown) {
    return { 
      ok: false, 
      error: err instanceof Error ? err.message : "Xatolik yuz berdi" 
    };
  }
}

export async function cashOtpVerifyAction(input: { booking_id: string; otp_code: string }): Promise<{ ok: true; bookingId: string; status: string } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    const options = session ? { token: session.accessToken } : undefined;
    const res = await api.bookings.verifyCashOtp(input.booking_id, input.otp_code, options);
    return { ok: true, bookingId: res.bookingId, status: res.status };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof ApiRequestError ? (error.code || error.message) : "UNKNOWN_ERROR"
    };
  }
}

export async function cashOtpResendAction(input: { booking_id: string }): Promise<{ ok: true; expiresIn: number; resendAvailableIn: number } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    const options = session ? { token: session.accessToken } : undefined;
    const res = await api.bookings.resendCashOtp(input.booking_id, options);
    return { ok: true, expiresIn: res.expiresIn, resendAvailableIn: res.resendAvailableIn };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof ApiRequestError ? (error.code || error.message) : "UNKNOWN_ERROR"
    };
  }
}
