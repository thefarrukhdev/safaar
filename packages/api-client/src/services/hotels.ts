import { rawApi } from "../client";
import { camelizeKeys } from "../case";
import { toHotelDetail, toHotelListItem } from "../adapters";
import type { Locale, HotelListItem, HotelDetail } from "../types";

export interface HotelListParams {
  cityId?: string;
  search?: string;
  stars?: number;
  page?: number;
  limit?: number;
  featured?: boolean;
  sort?: "price_asc" | "price_desc" | "rating";
  minPrice?: number;
  maxPrice?: number;
  neLat?: number;
  neLng?: number;
  swLat?: number;
  swLng?: number;
  /**
   * Yashash-joyi turi bo'yicha filtr (`partner_organizations.type`). Kategoriya
   * sahifalari uchun: `dacha`, `resort`, `sanatorium` va h.k. Berilmasa —
   * umumiy "Mehmonxonalar" katalogi qaytadi.
   */
  type?: string;
  paymentType?: "online_payment" | "pay_at_property";
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  amenities?: string[];
}

export interface HotelListResult {
  items: HotelListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface RawListResponse {
  items?: unknown[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export const hotelsService = {
  /** `GET /hotels` — e'lon qilingan mehmonxonalar ro'yxati. */
  async getHotels(
    locale: Locale,
    params: HotelListParams = {},
  ): Promise<HotelListResult> {
    const raw = await rawApi.get<unknown>("/hotels", {
      query: {
        city_id: params.cityId,
        search: params.search,
        stars: params.stars,
        type: params.type,
        payment_type: params.paymentType,
        page: params.page,
        limit: params.limit,
        featured: params.featured ? "true" : undefined,
        sort: params.sort,
        min_price: params.minPrice,
        max_price: params.maxPrice,
        ne_lat: params.neLat,
        ne_lng: params.neLng,
        sw_lat: params.swLat,
        sw_lng: params.swLng,
        check_in: params.checkIn,
        check_out: params.checkOut,
        guests: params.guests,
        amenities: params.amenities?.join(","),
      },
      next: { revalidate: 60, tags: ["hotels", "search"] },
    } as any);

    const data = camelizeKeys<RawListResponse | unknown[]>(raw);
    const items = Array.isArray(data) ? data : (data.items ?? []);
    const mapped = (items ?? []).map((item) =>
      toHotelListItem(item as any, locale),
    );

    return {
      items: mapped,
      total: Array.isArray(data) ? mapped.length : (data.total ?? mapped.length),
      page: Array.isArray(data) ? 1 : (data.page ?? 1),
      limit: Array.isArray(data) ? mapped.length : (data.limit ?? mapped.length),
      totalPages: Array.isArray(data)
        ? 1
        : (data.totalPages ??
          Math.ceil((data.total ?? mapped.length) / (data.limit || mapped.length || 1))),
    };
  },

  /** `GET /hotels/:slugOrId` — bitta mehmonxona (xonalari bilan). */
  async getHotel(locale: Locale, slugOrId: string): Promise<HotelDetail> {
    const raw = await rawApi.get<unknown>(`/hotels/${encodeURIComponent(slugOrId)}`, {
      next: { revalidate: 60, tags: ["hotels", `hotel-${slugOrId}`] },
    } as any);
    return toHotelDetail(camelizeKeys(raw) as any, locale);
  },

  /** `GET /hotels/featured` — bosh sahifa uchun tanlangan mehmonxonalar. */
  async getFeaturedHotels(
    locale: Locale,
    params: HotelListParams = {},
  ): Promise<HotelListResult> {
    return this.getHotels(locale, { ...params, featured: true });
  },
};
