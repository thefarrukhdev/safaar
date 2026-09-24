"use server";

import { api } from "@/lib/api";
import { ApiRequestError } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { safeAction } from "@/lib/services/safe-action";

/**
 * Sevimli (favorite) server action'lari. Client `FavoriteButton` ularni
 * to'g'ridan-to'g'ri (event handler ichida) chaqiradi va natijaga qarab
 * holatini yangilaydi. Sessiya yo'q bo'lsa `ok:false, authRequired:true`
 * qaytadi — UI login'ga taklif qiladi (redirect emas, optimistik UX uchun).
 */

export interface FavoriteResult {
  ok: boolean;
  /** Qo'shilganda — yangi favorite id (keyin o'chirish uchun). */
  id?: string;
  /** Sessiya yo'q — kirish kerak. */
  authRequired?: boolean;
  error?: string;
}

export async function addFavoriteAction(
  targetType: "hotel" | "bus" | "restaurant" | "transport" | "attraction",
  targetId: string,
): Promise<FavoriteResult> {
  const session = await getSession();
  if (!session) return { ok: false, authRequired: true };
  if (!targetId) return { ok: false };

  try {
    const favorite = await api.users.addFavorite(
      { targetType, targetId },
      { token: session.accessToken },
    );
    return { ok: true, id: favorite.id };
  } catch (error: unknown) {
    return {
      ok: false,
      authRequired: error instanceof ApiRequestError && error.statusCode === 401,
    };
  }
}

export async function removeFavoriteAction(
  favoriteId: string,
): Promise<FavoriteResult> {
  const session = await getSession();
  if (!session) return { ok: false, authRequired: true };
  if (!favoriteId) return { ok: false };

  return safeAction<FavoriteResult>(
    async () => {
      await api.users.removeFavorite(favoriteId, { token: session.accessToken });
      return { ok: true };
    },
    { ok: false },
  );
}
