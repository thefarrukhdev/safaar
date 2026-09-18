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

  const paymentMethod = (String(formData.get("paymentMethod") ?? "click")) as
    | "click"
    | "payme"
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
    redirect(`/${locale}/booking/${bookingId}?status=confirmed&payment=cash${guestAccessTokenParam}`);
  }

  // MUHIM: bu yerdan endi Uzum/Click/Payme checkoutiga TO'G'RIDAN-TO'G'RI
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
  const paymentMethod = (String(formData.get("paymentMethod") ?? "click")) as
    | "click"
    | "payme"
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
