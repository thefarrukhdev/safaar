/**
 * safeAction — Server Action'lar uchun markazlashgan xato boshqaruvchi.
 *
 * Har bir action'dagi takrorlangan try/catch blokini yo'q qiladi va
 * ApiRequestError'dan kelib chiqadigan error code'ni avtomatik chiqaradi.
 *
 * Ishlatish:
 *   return safeAction(() => api.something(), { ok: false, error: "ERROR" });
 *
 * Agar action Next.js `redirect()` chaqirsa, u exception sifatida tashlanadi.
 * Bu wrapper uni ushlamaydi — redirect ishlab ketadi.
 */

import { ApiRequestError } from "@/lib/api";

/** redirect() ichkarida NEXT_REDIRECT xatosi tashlaydi — buni ushlash kerak emas */
const isRedirectError = (e: unknown): boolean =>
  typeof e === "object" &&
  e !== null &&
  "digest" in e &&
  typeof (e as Record<string, unknown>).digest === "string" &&
  (e as Record<string, unknown>).digest === "NEXT_REDIRECT";

/**
 * ApiRequestError'dan error string'ni chiqaradi.
 * `error.code` ustunlik qiladi (backend enum kodi), bo'lmasa `error.message`.
 */
export type FieldErrors = Record<string, string[] | string>;

export function resolveApiError(error: unknown): { error: string; fields?: FieldErrors } {
  if (error instanceof ApiRequestError) {
    return {
      error: error.code || error.message || "ERROR",
      fields: error.fields as FieldErrors | undefined,
    };
  }
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    const code = typeof errObj.code === "string" && errObj.code ? errObj.code : undefined;
    const message = typeof errObj.message === "string" && errObj.message ? errObj.message : undefined;
    if (code || message) {
      return {
        error: code || message || "ERROR",
        fields: errObj.fields as FieldErrors | undefined,
      };
    }
  }
  return { error: "ERROR" };
}

/**
 * Server Action'lar uchun wrapper — try/catch'ni ichiga oladi.
 *
 * @param fn  - asinxron operatsiya
 * @param onError - xato holat (API xatosi kodiga `error` field inject qilinadi)
 */
export async function safeAction<T extends { error?: string; fields?: FieldErrors }>(
  fn: () => Promise<T>,
  onError: T,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isRedirectError(error)) throw error; // redirect() – qayta tashlash
    const resolved = resolveApiError(error);
    return { ...onError, error: resolved.error, fields: resolved.fields };
  }
}

/**
 * Sessiya tekshiruvini birlashtirgan wrapper.
 * Sessiya bo'lmasa `onUnauth` qaytaradi.
 *
 * @param getSession  - sessiyani qaytaruvchi funksiya
 * @param fn          - sessiya bilan chaqiriladigan asinxron operatsiya
 * @param onUnauth    - autentifikatsiya yo'q holat
 * @param onError     - boshqa xato holat
 */
export async function safeAuthAction<S, T extends { error?: string; fields?: FieldErrors }>(
  getSessionFn: () => Promise<S | null>,
  fn: (session: S) => Promise<T | Omit<T, "error" | "fields">>,
  onUnauth: T,
  onError: T,
): Promise<T> {
  const session = await getSessionFn();
  if (!session) return onUnauth;

  return safeAction(() => fn(session) as Promise<T>, onError);
}
