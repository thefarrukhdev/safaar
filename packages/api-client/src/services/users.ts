import type { NotificationPreferencesView } from "../types";
import { rawApi } from "../client";
import { camelizeKeys } from "../case";
import { toBookingView, toBonusView, toFavoriteView, toProfileView } from "../adapters";
import type { ProfileView, FavoriteView, BonusView, BookingView } from "../types";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AddFavoriteInput {
  targetType: "hotel" | "bus" | "restaurant" | "transport" | "attraction";
  targetId: string;
}

export const usersService = {
  /** `GET /me` — joriy foydalanuvchi profili. */
  async getProfile(options?: { token?: string }): Promise<ProfileView> {
    const raw = await rawApi.get<unknown>("/me", {
      ...options,
      cache: "no-store",
    });
    return toProfileView(camelizeKeys(raw));
  },

  /** `PATCH /me` — profilni yangilash. */
  async updateProfile(
    input: UpdateProfileInput,
    options?: { token?: string },
  ): Promise<ProfileView> {
    const raw = await rawApi.patch<unknown>(
      "/me",
      {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
      },
      options,
    );
    return toProfileView(camelizeKeys(raw));
  },

  /** `GET /me/bookings` — foydalanuvchi bronlari. */
  async getMyBookings(options?: { token?: string }): Promise<BookingView[]> {
    const raw = await rawApi.get<unknown>("/me/bookings", {
      ...options,
      cache: "no-store",
    });
    const items = camelizeKeys<unknown[]>(raw);
    return (items ?? []).map((item) => toBookingView(item as Parameters<typeof toBookingView>[0]));
  },

  /** `GET /me/favorites` — sevimlilar ro'yxati. */
  async getFavorites(options?: { token?: string }): Promise<FavoriteView[]> {
    const raw = await rawApi.get<unknown>("/me/favorites", {
      ...options,
      cache: "no-store",
    });
    const items = camelizeKeys<unknown[]>(raw);
    return (items ?? []).map((item) => toFavoriteView(item as Parameters<typeof toFavoriteView>[0]));
  },

  /** `GET /me/bonuses` — bonus balansi va tarixi. */
  async getBonuses(options?: { token?: string }): Promise<BonusView> {
    const raw = await rawApi.get<unknown>("/me/bonuses", {
      ...options,
      cache: "no-store",
    });
    return toBonusView(camelizeKeys(raw));
  },

  /** `POST /me/favorites` — sevimliga qo'shish (yaratilgan yozuvni qaytaradi). */
  async addFavorite(
    input: AddFavoriteInput,
    options?: { token?: string },
  ): Promise<FavoriteView> {
    const raw = await rawApi.post<unknown>(
      "/me/favorites",
      { target_type: input.targetType, target_id: input.targetId },
      options,
    );
    return toFavoriteView(camelizeKeys(raw));
  },

  /** `DELETE /me/favorites/:id` — sevimlidan olib tashlash. */
  async removeFavorite(favoriteId: string, options?: { token?: string }): Promise<void> {
    await rawApi.delete<unknown>(
      `/me/favorites/${encodeURIComponent(favoriteId)}`,
      options,
    );
  },

  /**
   * Berilgan obyekt (mehmonxona/avtobus) sevimlilar ro'yxatida bormi —
   * mavjud bo'lsa favorite id'sini qaytaradi (detal sahifasida holatni
   * aniqlash uchun). Sessiya yo'q bo'lsa `null`.
   */
  async findFavoriteId(targetId: string, options?: { token?: string }): Promise<string | null> {
    const favorites = await this.getFavorites(options);
    return favorites.find((f) => f.targetId === targetId)?.id ?? null;
  },

  /** `POST /me/avatar` — profil rasmini yuklash. */
  async uploadAvatar(file: File, options?: { token?: string }): Promise<ProfileView> {
    const formData = new FormData();
    formData.append("file", file);
    
    const raw = await rawApi.post<unknown>("/me/avatar", formData, {
      ...options,
      headers: {
        // fetch yuborayotganda FormData bo'lsa Content-Type avtomatik qoyiladi,
        // shuning uchun api-client da buni override qimaslik kerak (agar rawApi qollab quvvatlasa).
      },
    });
    return toProfileView(camelizeKeys(raw));
  },

  /** `DELETE /me/avatar` — profil rasmini o'chirish. */
  async deleteAvatar(options?: { token?: string }): Promise<ProfileView> {
    const raw = await rawApi.delete<unknown>("/me/avatar", options);
    return toProfileView(camelizeKeys(raw));
  },

  /** `GET /me/notifications/preferences` — bildirishnomalar sozlamalari. */
  async getNotificationPreferences(options?: { token?: string }): Promise<NotificationPreferencesView> {
    return rawApi.get<NotificationPreferencesView>("/me/notifications/preferences", options);
  },

  /** `PATCH /me/notifications/preferences` — bildirishnomalar sozlamalarini yangilash. */
  async updateNotificationPreferences(data: unknown, options?: { token?: string }): Promise<NotificationPreferencesView> {
    return rawApi.patch<NotificationPreferencesView>("/me/notifications/preferences", data, options);
  },

  /** `POST /me/data-export` — ma'lumotlarni eksport qilish so'rovi. */
  async requestDataExport(options?: { token?: string }): Promise<void> {
    await rawApi.post<unknown>("/me/data-export", {}, options);
  },

  /** `POST /me/delete-request` — akkauntni o'chirish so'rovi. */
  async requestAccountDeletion(options?: { token?: string }): Promise<void> {
    await rawApi.post<unknown>("/me/delete-request", {}, options);
  },
};
