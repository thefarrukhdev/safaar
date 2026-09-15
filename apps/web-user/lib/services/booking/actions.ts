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
  
  const paymentMethod = (String(formData.get("paymentMethod") ?? "click")) as "click" | "payme" | "uzcard" | "humo" | "cash";
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
  };
  let bookingId = "";
  let checkoutUrl = "";

  try {
    const booking = await api.bookings.createHotelBooking(input, { token: session?.accessToken });
    bookingId = booking.id;

    if (paymentMethod === "cash") {
      redirect(`/${locale}/booking/${bookingId}?status=confirmed&payment=cash`);
    }

    try {
      const paymentSession = await api.payments.createPaymentSession(bookingId, paymentMethod, {
        token: session?.accessToken,
      });
      if (paymentSession.paymentUrl) {
        checkoutUrl = paymentSession.paymentUrl;
      }
    } catch {
      // Fall back to booking details page if payment session fails
    }
  } catch (error) {
    await redirectToLoginIfSessionExpired(error, locale);
    return {
      error: error instanceof ApiRequestError ? error.message : "ERROR",
    };
  }

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  redirect(`/${locale}/booking/${bookingId}?payment=pending&provider=${paymentMethod}`);
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
  const paymentMethod = (String(formData.get("paymentMethod") ?? "click")) as "click" | "payme" | "uzcard" | "humo" | "cash";

  if (!tripId || seats.length === 0) {
    return { error: "NO_SEATS" };
  }

  let bookingId = "";
  let checkoutUrl = "";
  try {
    const booking = await api.bookings.createBusBooking({
      tripId,
      seats,
      paymentMethod,
    }, { token: session.accessToken });
    bookingId = booking.id;

    if (paymentMethod === "cash") {
      redirect(`/${locale}/booking/${bookingId}?status=confirmed&payment=cash`);
    }

    try {
      const paymentSession = await api.payments.createPaymentSession(bookingId, paymentMethod, {
        token: session.accessToken,
      });
      if (paymentSession.paymentUrl) {
        checkoutUrl = paymentSession.paymentUrl;
      }
    } catch {
      // Fall back to booking details page
    }
  } catch (error) {
    await redirectToLoginIfSessionExpired(error, locale);
    return {
      error: error instanceof ApiRequestError ? error.message : "ERROR",
    };
  }

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  redirect(`/${locale}/booking/${bookingId}?payment=pending&provider=${paymentMethod}`);
}
