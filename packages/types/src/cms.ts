export interface Deal {
  id: string;
  hotel_id: string;
  slug: string;
  name: Record<string, string>;
  city_name: Record<string, string>;
  image_url: string;
  old_price: number;
  new_price: number;
  discount_percent: number;
  ends_at: string;
  status: string;
  /**
   * E'lon turi (`hotels` | `dachas` | `restaurants` | `sanatoriums` |
   * `resorts` | `transport`) — bosh sahifadagi deal kartasi qaysi katalog
   * sahifasiga havola qilishini belgilaydi. Eski yozuvlarda bo'lmasligi
   * mumkin, shuning uchun optional va bo'sh satr qaytishi mumkin.
   */
  listing_type?: string;
}

export interface PopularCity {
  id: string;
  name: Record<string, string>;
  slug: string;
  image_url: string;
  hotel_count: number;
  sort_order: number;
}

export interface PartnerShowcase {
  id: string;
  company_name: string;
  logo_url: string;
  type: string;
  sort_order: number;
}

export interface PublicStats {
  total_hotels: number;
  total_cities: number;
  average_rating: number;
  total_bookings: number;
  total_partners: number;
}
