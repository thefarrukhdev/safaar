"use server";

import { redirect } from "next/navigation";
import { api, ApiRequestError } from "@/lib/api";
import { config } from "@/lib/config/config";
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

function extractErrorCode(data: any, fallback = "ERROR"): string {
  if (!data) return fallback;
  if (data.error && typeof data.error === "object") {
    if (data.error.code) return String(data.error.code);
    if (data.error.message) return String(data.error.message);
  }
  if (data.code) return String(data.code);
  if (data.message) return String(data.message);
  return fallback;
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
  verificationToken?: string;
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
    const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
    const res = await fetch(`${base}bookings/hotel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: JSON.stringify({
        hotel_id: input.restaurantId,
        room_id: input.tableId || input.restaurantId,
        check_in: input.date,
        check_out: input.date,
        slot_time: input.slotTime,
        guests: input.guests,
        total_price: input.totalPrice,
        guest_name: input.guestName,
        guest_phone: input.guestPhone,
        guest_email: input.guestEmail,
        source: "web-user",
        payment_method: input.paymentMethod,
        agree_terms: input.agreeTerms,
        verification_token: input.verificationToken,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return {
        ok: false,
        error: extractErrorCode(data, "ERROR"),
      };
    }

    const bookingId = data.booking?.id || data.id;
    const guestAccessToken = data.guestAccessToken || data.guest_access_token;
    const bookingNumber = data.booking?.booking_number || data.bookingNumber;

    return {
      ok: true,
      bookingId,
      bookingNumber,
      guestAccessToken,
      requiresOtp: Boolean(data.requires_otp || data.requiresOtp),
      maskedPhone: data.masked_phone || data.maskedPhone,
      expiresIn: data.expires_in || data.expiresIn,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Xatolik yuz berdi",
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
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  specialRequests?: string;
  promoCode?: string;
  agreeTerms: boolean;
  locale?: string;
  verificationToken?: string;
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
  const fullName = input.fullName || [input.firstName, input.lastName].filter(Boolean).join(" ");

  try {
    const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
    const res = await fetch(`${base}bookings/hotel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: JSON.stringify({
        hotel_id: input.hotelId,
        room_id: input.roomId,
        check_in: input.checkIn,
        check_out: input.checkOut,
        rooms: 1,
        adults: input.guests ?? 1,
        payment_method: input.paymentMethod,
        firstName: input.firstName,
        lastName: input.lastName,
        fullName,
        guest_name: fullName,
        guest_email: input.email,
        guest_phone: input.phone,
        email: input.email,
        phone: input.phone,
        special_requests: input.specialRequests,
        promo_code: input.promoCode,
        agree_terms: input.agreeTerms,
        verification_token: input.verificationToken,
        source: "web-user",
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return {
        ok: false,
        error: extractErrorCode(data, "ERROR"),
      };
    }

    const bookingId = data.booking?.id || data.id;
    const guestAccessToken = data.guestAccessToken || data.guest_access_token;

    return {
      ok: true,
      bookingId,
      guestAccessToken,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Xatolik yuz berdi",
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
  verificationToken?: string;
}): Promise<{
  ok: boolean;
  bookingId?: string;
  guestAccessToken?: string;
  error?: string;
}> {
  const session = await getSession();

  try {
    const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
    const res = await fetch(`${base}bookings/vehicle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: JSON.stringify({
        vehicle_id: input.vehicleId,
        check_in: input.checkIn,
        check_out: input.checkOut,
        guest_name: input.guestName,
        guest_phone: input.guestPhone,
        guest_email: input.guestEmail,
        payment_method: input.paymentMethod,
        verification_token: input.verificationToken,
        source: "web-user",
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return {
        ok: false,
        error: extractErrorCode(data, "ERROR"),
      };
    }

    const bookingId = data.booking?.id || data.id || data.booking?.booking_number || data.bookingNumber;
    const guestAccessToken = data.guestAccessToken || data.guest_access_token;

    return {
      ok: true,
      bookingId,
      guestAccessToken,
    };
  } catch (err: unknown) {
    return { 
      ok: false, 
      error: err instanceof Error ? err.message : "Xatolik yuz berdi" 
    };
  }
}

export async function sendCashOtpAction(input: {
  phone: string;
}): Promise<{
  ok: true;
  challengeId?: string;
  resendAfter?: number;
} | {
  ok: false;
  error: string;
}> {
  try {
    const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
    const res = await fetch(`${base}bookings/cash/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ phone: input.phone }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return {
        ok: false,
        error: extractErrorCode(data, "OTP_SEND_FAILED"),
      };
    }

    return {
      ok: true,
      challengeId: data.challenge_id || data.challengeId,
      resendAfter: data.resend_after || data.resendAfter,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "OTP_SEND_FAILED",
    };
  }
}

export async function cashOtpVerifyAction(input: {
  phone: string;
  otp_code: string;
  challenge_id?: string;
  booking_id?: string;
}): Promise<{
  ok: true;
  verificationToken?: string;
  bookingId?: string;
  status?: string;
} | {
  ok: false;
  error: string;
}> {
  try {
    const session = await getSession();
    const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
    const res = await fetch(`${base}bookings/cash/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: JSON.stringify({
        phone: input.phone,
        otp_code: input.otp_code,
        challenge_id: input.challenge_id,
        booking_id: input.booking_id,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return {
        ok: false,
        error: extractErrorCode(data, "UNKNOWN_ERROR"),
      };
    }

    return {
      ok: true,
      verificationToken: data.verification_token || data.verificationToken,
      bookingId: data.booking?.id || data.bookingId || input.booking_id,
      status: data.status || data.booking?.status,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}

export async function cashOtpResendAction(input: {
  phone?: string;
  booking_id?: string;
}): Promise<{
  ok: true;
  expiresIn?: number;
  resendAvailableIn?: number;
} | {
  ok: false;
  error: string;
}> {
  try {
    const session = await getSession();
    const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
    const endpoint = input.booking_id
      ? `${base}bookings/${encodeURIComponent(input.booking_id)}/send-cash-otp`
      : `${base}bookings/cash/send-otp`;
    const body = input.phone ? { phone: input.phone } : { booking_id: input.booking_id };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return {
        ok: false,
        error: extractErrorCode(data, "UNKNOWN_ERROR"),
      };
    }

    return {
      ok: true,
      expiresIn: data.expires_in || 180,
      resendAvailableIn: data.resend_available_in || data.resend_after || 60,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}
