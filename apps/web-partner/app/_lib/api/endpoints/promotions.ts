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
  hotelId: string;
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
  submitPromotion: async (draft: PromotionDraft, token?: string): Promise<Promotion> => {
    return request<Promotion>('/partners/promotions', {
      method: 'POST',
      body: draft,
      token,
    });
  },

  getPromotions: async (hotelId: string, token?: string): Promise<Promotion[]> => {
    return request<Promotion[]>('/partners/promotions', {
      method: 'GET',
      token,
    });
  },
};
