import { rawApi } from "../client";
import { camelizeKeys } from "../case";
import type { PromoView } from "../types";

export const promosService = {
  /**
   * `GET /promos` — hozir amal qiladigan promo-kodlar (ommaviy).
   * Admin panelda o'zgartirilishi bilan darhol ko'rinishi kerak, shuning
   * uchun keshsiz (`no-store`) so'raladi.
   */
  async listActive(): Promise<PromoView[]> {
    const raw = await rawApi.get<unknown[]>("/promos", { cache: "no-store" });
    return camelizeKeys<PromoView[]>(raw);
  },

  /**
   * `POST /promos/validate` — checkout'da promo-kodni tekshiradi.
   */
  async validate(code: string): Promise<{ valid: boolean; discount_type: string; discount_value: number }> {
    const raw = await rawApi.post<{ valid: boolean; discount_type: string; discount_value: number }>("/promos/validate", { code });
    return raw;
  },
};
