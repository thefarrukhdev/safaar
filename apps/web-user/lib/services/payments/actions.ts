"use server";

import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/i18n/config";
import { safeAction } from "@/lib/services/safe-action";
import type { PaymentProvider, PaymentResult } from "./payments";

export interface RetryPaymentState {
  error?: string;
  url?: string;
}

/**
 * "Fee va final amount ko'rish" bosqichi uchun — `POST
 * /payments/:bookingId/create`ni chaqiradi va NATIJANI QAYTARADI (redirect
 * QILMAYDI). Backend bu so'rovda allaqachon yakuniy (fee-inclusive) summani
 * hisoblab qaytaradi — frontend buni mustaqil hisoblamaydi, faqat
 * ko'rsatadi (docs/frontend-payment-integration.md, 4-bo'lim).
 *
 * Guest (login qilmagan, `guestAccessToken` orqali) va login qilgan
 * foydalanuvchi — ikkalasi ham qo'llab-quvvatlanadi, backend contractiga
 * mos (`?guestToken=` query parametri). Hech biri bo'lmasa — aniq xato
 * qaytaradi (redirect QILMAYDI, chunki bu client tomonidan boshqariladigan
 * preview chaqiruvi — navigatsiya emas).
 */
export async function previewPayment(
  bookingId: string,
  provider: PaymentProvider,
  guestToken?: string,
): Promise<{ error?: string; payment?: PaymentResult }> {
  if (!bookingId) {
    return { error: "INVALID_BOOKING" };
  }
  const session = await getSession();
  if (!session && !guestToken) {
    return { error: "AUTH_TOKEN_INVALID" };
  }

  return safeAction<{ error?: string; payment?: PaymentResult }>(
    async () => {
      const payment = await api.payments.createPaymentSession(bookingId, provider, {
        token: session?.accessToken,
        guestToken,
      });
      return { payment };
    },
    { error: "ERROR" },
  );
}

/**
 * Yakuniy "To'lash" bosqichi — form orqali (`useActionState`) chaqiriladi.
 * Odatda `previewPayment()` allaqachon chaqirilgan va `payment_url` client
 * state'da bor bo'ladi (shu holda component to'g'ridan-to'g'ri
 * `window.location.href` bilan navigatsiya qiladi, bu action UMUMAN
 * chaqirilmaydi). Bu action — fallback/qayta-urinish yo'li: agar client
 * state yo'qolgan bo'lsa (masalan sahifa qayta ochilgan) ham forma
 * to'g'ri ishlashi uchun.
 */
export async function createPaymentSessionAction(
  _prev: RetryPaymentState,
  formData: FormData,
): Promise<RetryPaymentState> {
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const provider = (String(formData.get("paymentMethod") ?? "click")) as PaymentProvider;
  const guestToken = String(formData.get("guestToken") ?? "").trim() || undefined;
  const guestTokenParam = guestToken ? `&guestToken=${encodeURIComponent(guestToken)}` : "";

  const session = await getSession();
  // Guest (login qilmagan, lekin o'z bronining `guestAccessToken`iga ega)
  // mijoz endi backend contractiga mos ravishda o'tkaziladi — faqat
  // ikkalasi ham (session HAM guestToken) yo'q bo'lsagina login sahifasiga
  // yo'naltiriladi.
  if (!session && !guestToken) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/booking/${bookingId}`)}`);
  }

  if (!bookingId) {
    return { error: "INVALID_BOOKING" };
  }

  if (provider === "cash") {
    redirect(`/${locale}/booking/${bookingId}?status=confirmed&payment=cash${guestTokenParam}`);
  }

  const result = await safeAction<RetryPaymentState>(
    async () => {
      const res = await api.payments.createPaymentSession(bookingId, provider, {
        token: session?.accessToken,
        guestToken,
      });
      return { url: res.paymentUrl ?? "" };
    },
    { error: "ERROR" },
  );

  if (result.error) return result;
  const checkoutUrl = result.url ?? "";

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  redirect(`/${locale}/booking/${bookingId}?payment=pending&provider=${provider}${guestTokenParam}`);
}
