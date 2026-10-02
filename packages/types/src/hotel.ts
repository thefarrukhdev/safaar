export interface Hotel {
  id: string;
  name: string;
  city: string;
  /** Bir kechalik narx (so'm). */
  pricePerNight: number;
  /** O'rtacha reyting (0–5). */
  rating: number;
  /** Yulduzlar soni (1–5). */
  stars: number;
  description?: string;
  amenities?: string[];
  images?: string[];
  allows_cash?: boolean;
  allows_online_payment?: boolean;
}

export type HotelLanguage = 'uz' | 'ru' | 'en';

export type LocalizedText = Record<HotelLanguage, string | null>;

export type HotelListingStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'hidden'
  | 'rejected';

export interface HotelMediaAsset {
  id: string;
  url: string;
  mime_type: string;
  caption: string | null;
  category: string | null;
  sort_order: number;
  is_cover: boolean;
}

export interface HotelListingCompleteness {
  score: number;
  is_complete: boolean;
  is_publishable: boolean;
  missing_fields: string[];
  sections: {
    general: boolean;
    location: boolean;
    media: boolean;
    amenities: boolean;
    rules: boolean;
    rooms: boolean;
  };
}

export interface AdminHotelListItem {
  id: string;
  slug: string;
  status: HotelListingStatus;
  name: LocalizedText;
  short_description: LocalizedText;
  full_description: LocalizedText;
  stars: number;
  featured: boolean;
  address: string;
  latitude: number | null;
  longitude: number | null;
  city: {
    id: string;
    name: LocalizedText;
    region: { id: string; name: LocalizedText } | null;
  } | null;
  partner: {
    id: string;
    legal_name: string;
    brand_name: string;
    status: string;
  } | null;
  cover_image: HotelMediaAsset | null;
  image_count: number;
  amenity_count: number;
  room_summary: {
    room_type_count: number;
    active_room_count: number;
    total_inventory: number;
    min_price: number | null;
  };
  completeness: HotelListingCompleteness;
  created_at: string;
  updated_at: string;
}

export interface AdminHotelDetail extends AdminHotelListItem {
  media: HotelMediaAsset[];
  amenities: Array<{
    id: string;
    code: string;
    name: LocalizedText;
  }>;
  rules: {
    check_in_time: string | null;
    check_out_time: string | null;
    cancellation_policy_code: string;
    smoking_allowed: boolean;
    pets_allowed: boolean;
    children_allowed: boolean;
    extra_fees: unknown[];
    completed_at: string | null;
    allows_cash?: boolean;
    allows_online_payment?: boolean;
  };
  room_types: Array<{
    id: string;
    code: string;
    name: LocalizedText;
    rooms: Array<{
      id: string;
      code: string;
      name: LocalizedText;
      description: LocalizedText;
      base_occupancy: number;
      max_adults: number;
      max_children: number;
      total_inventory: number;
      base_price: number;
      status: string;
      amenities: Array<{ id: string; code: string; name: LocalizedText }>;
    }>;
  }>;
  moderation: {
    submitted_at: string | null;
    reviewed_at: string | null;
    reviewed_by: string | null;
    rejection_reason: string | null;
  };
}

export interface RoomType {
  id: string;
  hotelId: string;
  name: string;
  pricePerNight: number;
  capacity: number;
  available: number;
}

/** Mehmonxona qidiruv parametrlari. */
export interface HotelSearchQuery {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  minPrice?: number;
  maxPrice?: number;
  stars?: number;
  minStars?: number;
  type?: string;
  types?: string[];
  amenities?: string[];
  paymentType?: 'online_payment' | 'pay_at_property' | 'cash';
}
