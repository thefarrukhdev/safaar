import { rawApi } from "../client";
import { camelizeKeys } from "../case";
import { toReviewView } from "../adapters";
import type { ReviewView } from "../types";

interface RawReviewItem {
  status?: string;
}

function mapReviews(raw: unknown): ReviewView[] {
  const items = camelizeKeys<(RawReviewItem & Record<string, unknown>)[]>(raw);
  return (items ?? [])
    .filter((item) => (item.status ?? "published") !== "hidden")
    .map((item) => toReviewView(item));
}

export const reviewsService = {
  /** `GET /hotels/:id/reviews` — mehmonxona sharhlari. */
  async getHotelReviews(hotelId: string): Promise<ReviewView[]> {
    const raw = await rawApi.get<unknown>(
      `/hotels/${encodeURIComponent(hotelId)}/reviews`,
      { next: { revalidate: 60 } } as any,
    );
    return mapReviews(raw);
  },

  /** `GET /bus-companies/:id/reviews` — avtobus kompaniyasi sharhlari. */
  async getBusCompanyReviews(companyId: string): Promise<ReviewView[]> {
    if (!companyId) return [];
    const raw = await rawApi.get<unknown>(
      `/bus-companies/${encodeURIComponent(companyId)}/reviews`,
      { next: { revalidate: 60 } } as any,
    );
    return mapReviews(raw);
  },

  /** `GET /restaurants/:id/reviews` — restoran sharhlari. */
  async getRestaurantReviews(restaurantId: string): Promise<ReviewView[]> {
    if (!restaurantId) return [];
    const raw = await rawApi.get<unknown>(
      `/restaurants/${encodeURIComponent(restaurantId)}/reviews`,
      { next: { revalidate: 60 } } as any,
    );
    return mapReviews(raw);
  },

  /** `GET /attractions/:id/reviews` — diqqatga sazovor joylar sharhlari. */
  async getAttractionReviews(attractionId: string): Promise<ReviewView[]> {
    if (!attractionId) return [];
    const raw = await rawApi.get<unknown>(
      `/attractions/${encodeURIComponent(attractionId)}/reviews`,
      { next: { revalidate: 60 } } as any,
    );
    return mapReviews(raw);
  },

  /** `POST /reviews` — sharh yaratish. */
  async createReview(data: { targetType: string; targetId: string; rating: number; body: string; photos?: string[] }, options?: { token?: string }): Promise<ReviewView> {
    const raw = await rawApi.post<unknown>(
      "/reviews",
      {
        target_type: data.targetType,
        target_id: data.targetId,
        rating: data.rating,
        body: data.body,
        photos: data.photos,
      },
      options,
    );
    return toReviewView(camelizeKeys(raw) as any);
  },

  /** `POST /reviews/photos` — sharh uchun rasmlar yuklash. */
  async uploadReviewPhotos(files: File[], options?: { token?: string }): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    
    const raw: any = await rawApi.post<unknown>("/reviews/photos", formData, {
      ...options,
      // let FormData set Content-Type
    });
    return raw.urls ?? [];
  },
};
