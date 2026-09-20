// Mock API until backend provides real endpoint

export interface PromotionDraft {
  oldPriceSum: number;
  newPriceSum: number;
  discountPercent: number;
  endsAt: string;
}

export interface Promotion {
  id: string;
  hotelId: string;
  oldPriceSum: number;
  newPriceSum: number;
  discountPercent: number;
  endsAt: string;
  status: "pending_review" | "published" | "rejected";
  createdAt: string;
}

export const promotions = {
  /**
   * TODO: Backend dev API yaratgach `apiClient.post(...)` orqali ulash kerak
   */
  submitPromotion: async (draft: PromotionDraft, token?: string): Promise<Promotion> => {
    // MOCK:
    await new Promise((resolve) => setTimeout(resolve, 800));
    return {
      id: "mock-promo-1",
      hotelId: "mock-hotel-id",
      oldPriceSum: draft.oldPriceSum,
      newPriceSum: draft.newPriceSum,
      discountPercent: draft.discountPercent,
      endsAt: draft.endsAt,
      status: "pending_review",
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * TODO: Backend dev API yaratgach ulash
   */
  getPromotions: async (hotelId: string, token?: string): Promise<Promotion[]> => {
    // MOCK:
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [];
  },
};
