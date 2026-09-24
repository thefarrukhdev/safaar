// Mock API until backend provides real endpoint

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

let mockPromotions: Promotion[] = [];

export const promotions = {
  /**
   * TODO: Backend dev API yaratgach `apiClient.post(...)` orqali ulash kerak
   */
  submitPromotion: async (draft: PromotionDraft, token?: string): Promise<Promotion> => {
    // MOCK:
    await new Promise((resolve) => setTimeout(resolve, 800));
    const newPromo: Promotion = {
      id: "mock-promo-" + Date.now(),
      hotelId: "mock-hotel-id",
      entityId: draft.entityId,
      entityName: draft.entityName,
      entityType: draft.entityType,
      oldPriceSum: draft.oldPriceSum,
      newPriceSum: draft.newPriceSum,
      discountPercent: draft.discountPercent,
      startDate: draft.startDate,
      endDate: draft.endDate,
      status: "pending_review",
      createdAt: new Date().toISOString(),
    };
    mockPromotions.unshift(newPromo);
    return newPromo;
  },

  /**
   * TODO: Backend dev API yaratgach ulash
   */
  getPromotions: async (hotelId: string, token?: string): Promise<Promotion[]> => {
    // MOCK:
    await new Promise((resolve) => setTimeout(resolve, 500));
    return [...mockPromotions];
  },
};
