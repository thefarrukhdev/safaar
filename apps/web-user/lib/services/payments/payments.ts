import { ApiRequestError } from "@safaar/api-client";
import { config } from "@/lib/config";

// `humo`/`uzcard`/`visa`/`mastercard` — backend'da barchasi Uzum Checkout
// orqali ishlaydi (bitta texnik transport, foydalanuvchiga ko'rinmaydi),
// karta turi FEE stavkasini belgilaydi (1.5% / 3.5%). Qarang
// docs/frontend-payment-integration.md, 4-bo'lim.
export type PaymentProvider =
  | "uzcard"
  | "humo"
  | "visa"
  | "mastercard"
  | "cash";

export interface CreatePaymentInput {
  provider: PaymentProvider;
}

export interface PaymentResult {
  id: string;
  bookingId: string;
  provider: string;
  status: string;
  /** Foydalanuvchi HAQIQATDA to'laydigan/to'lagan yakuniy summa (fee bilan). */
  amount: number;
  /** Bron gross summasi (fee qo'shilmasdan oldin). Karta-fee qo'llanmasa `amount`ga teng. */
  baseAmount: number;
  /** Qo'llangan fee stavkasi (masalan 0.015 = 1.5%). Fee yo'q bo'lsa 0. */
  feeRate: number;
  /** Foydalanuvchi to'laydigan qo'shimcha fee summasi. Fee yo'q bo'lsa 0. */
  feeAmount: number;
  currency: string;
  paymentUrl?: string;
}

interface RequestOptions {
  token?: string;
  /** Guest (login qilmagan) mijoz uchun — backend shu orqali bron egaligini tasdiqlaydi. */
  guestToken?: string;
}

function withGuestTokenQuery(path: string, guestToken?: string): string {
  if (!guestToken) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}guestToken=${encodeURIComponent(guestToken)}`;
}

/**
 * Backend xato javobi `{ success: false, error: { code, message, fields }, meta }`
 * ko'rinishida keladi (`HttpErrorFilter`) — `code`/`message` NESTED,
 * top-level EMAS. Bu funksiya `@safaar/api-client`ning o'z
 * `extractApiError()`i bilan BIR XIL, tasdiqlangan mantiq (shu fayl
 * o'zining alohida `fetch` wrapperini ishlatgani uchun bu yerda
 * TAKRORLANGAN) — buni to'g'ri o'qimaslik `error.code`ni doim
 * `undefined` qilib qo'yardi, va shu bilan `RetryPaymentForm`dagi
 * aniq xato xabarlari (masalan `PAYMENT_PROVIDER_NOT_CONFIGURED`)
 * hech qachon ko'rsatilmasdi — faqat umumiy "ERROR" fallback.
 */
function extractErrorFields(
  payload: Record<string, unknown> | null,
  res: Response,
): { message: string; code: string | undefined; fields: unknown } {
  const nested =
    payload && typeof payload.error === "object" && payload.error !== null
      ? (payload.error as Record<string, unknown>)
      : undefined;
  return {
    message:
      (nested?.message as string | undefined) ??
      (payload?.message as string | undefined) ??
      res.statusText ??
      "Server error",
    code:
      (nested?.code as string | undefined) ??
      (payload?.code as string | undefined),
    fields: nested?.fields ?? payload?.fields,
  };
}

async function rawPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
  const fullPath = withGuestTokenQuery(path, options?.guestToken);
  const url = new URL(fullPath.replace(/^\//, ""), base).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !payload) {
    const extracted = extractErrorFields(payload, res);
    throw new ApiRequestError(
      { success: false, ...extracted },
      res.status
    );
  }
  return (payload.data ?? payload) as T;
}

async function rawGet<T>(path: string, options?: RequestOptions): Promise<T> {
  const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
  const fullPath = withGuestTokenQuery(path, options?.guestToken);
  const url = new URL(fullPath.replace(/^\//, ""), base).toString();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  });

  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !payload) {
    const extracted = extractErrorFields(payload, res);
    throw new ApiRequestError(
      { success: false, ...extracted },
      res.status
    );
  }
  return (payload.data ?? payload) as T;
}

function toPaymentResult(
  raw: Record<string, unknown>,
  fallback: { bookingId: string; provider: string },
): PaymentResult {
  const paymentUrl =
    (raw.payment_url as string | undefined) ??
    (raw.paymentUrl as string | undefined);
  const amount = Number(raw.amount ?? 0);
  // Click/Payme/Cash/Uzum (merchant) va schemasiz `uzum_checkout` uchun
  // backend `base_amount`/`fee_rate`/`fee_amount`ni umuman qaytarmasligi
  // mumkin (eski qatorlar, migratsiyadan oldingi) — bu holda fee yo'q,
  // `baseAmount = amount` deb hisoblanadi (backend'ning o'zidagi
  // "avvalgidek" konventsiyasi bilan bir xil).
  const baseAmount = raw.base_amount != null ? Number(raw.base_amount) : amount;
  const feeRate = raw.fee_rate != null ? Number(raw.fee_rate) : 0;
  const feeAmount = raw.fee_amount != null ? Number(raw.fee_amount) : 0;

  return {
    id: String(raw.id ?? fallback.bookingId),
    bookingId: String(raw.booking_id ?? fallback.bookingId),
    provider: String(raw.provider ?? fallback.provider),
    status: String(raw.status ?? "pending"),
    amount,
    baseAmount,
    feeRate,
    feeAmount,
    currency: String(raw.currency ?? "UZS"),
    paymentUrl,
  };
}

export const paymentsService = {
  /** `POST /payments/:bookingId/create` — to'lov sessiyasini yaratish/olish, fee bilan. */
  async createPaymentSession(
    bookingId: string,
    provider: PaymentProvider,
    options?: RequestOptions,
  ): Promise<PaymentResult> {
    const raw = await rawPost<Record<string, unknown>>(
      `/payments/${encodeURIComponent(bookingId)}/create`,
      { provider },
      options,
    );
    return toPaymentResult(raw, { bookingId, provider });
  },

  /** `GET /payments/:bookingId` — to'lov holatini tekshirish (backend — authoritative source). */
  async getPaymentStatus(
    bookingId: string,
    options?: RequestOptions,
  ): Promise<PaymentResult | null> {
    try {
      const raw = await rawGet<Record<string, unknown>>(
        `/payments/${encodeURIComponent(bookingId)}`,
        options,
      );
      return toPaymentResult(raw, { bookingId, provider: "" });
    } catch {
      return null;
    }
  },
};
