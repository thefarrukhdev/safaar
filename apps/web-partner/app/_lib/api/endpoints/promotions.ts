import { request } from '../client';

export interface PromotionDraft {
  entityId: string; // roomId or vehicleId
  entityName: string; // e.g. "Xona: 101" or "01A123AA (Cobalt)"
  entityType: "room" | "vehicle";
  oldPriceSum: number;
  newPriceSum: number;
  discountPercent: number;
  startDate: string;
  endDate: string;
}

export interface Promotion {
  id: string;
  entityId: string;
  entityName: string;
  entityType: "room" | "vehicle";
  oldPriceSum: number;
  newPriceSum: number;
  discountPercent: number;
  startDate: string;
  endDate: string;
  status: "pending_review" | "published" | "rejected";
  createdAt: string;
}

export const promotions = {
  /**
   * `POST /partners/promotions` — real backend (2026-09-24, backend commit
   * b7ee632d). Field names match the backend contract exactly (see
   * `apps/backend/src/common/promotion.ts`'s `toPromotionApiShape()`), no
   * transformation needed.
   */
  submitPromotion: async (draft: PromotionDraft, token?: string): Promise<Promotion> => {
    return request<Promotion>('/partners/promotions', {
      method: 'POST',
      body: draft,
      token,
    });
  },

  /**
   * `GET /partners/promotions` — real backend (2026-09-24, backend
   * "COMPLETE PARTNER PROMOTIONS RELOAD PERSISTENCE"). Server resolves the
   * partner organization from the JWT itself, not from a client-supplied
   * id — no `hotelId`/org param needed or accepted here.
   */
  getPromotions: async (token?: string): Promise<Promotion[]> => {
    return request<Promotion[]>('/partners/promotions', { token });
  },
};
