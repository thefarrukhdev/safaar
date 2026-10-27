/**
 * "E'lon" bo'limi — mehmonxona web-user'da qanday ko'rinishi.
 *
 * Backend `HotelRecord`da mos maydonlar bor (name, description, amenities,
 * images, check_in_time, check_out_time, stars, status). Real backend
 * kelganda bu turlar `@safaar/types` ga ko'chiriladi.
 */

/** E'lon nashr holati (mehmonxona hayotidagi bosqichlar). */
export enum ListingStatus {
  /** Qoralama — hali to'ldirilmagan, web-user'da yashirin */
  DRAFT = "DRAFT",
  /** Admin ko'rib chiqmoqda — web-user'da yashirin */
  UNDER_REVIEW = "UNDER_REVIEW",
  /** Nashr qilingan — web-user'da ko'rinadi va bron qilinadi */
  PUBLISHED = "PUBLISHED",
  /** Egasi tomonidan vaqtincha yashirilgan */
  HIDDEN = "HIDDEN",
}

/** Rasm kategoriyasi — mijoz galereyada filtrlaydi. */
export enum PhotoCategory {
  FACADE = "FACADE",
  LOBBY = "LOBBY",
  ROOM = "ROOM",
  BATHROOM = "BATHROOM",
  RESTAURANT = "RESTAURANT",
  POOL = "POOL",
  GYM = "GYM",
  SPA = "SPA",
  OTHER = "OTHER",
}

export interface ListingPhoto {
  id: string;
  url: string;
  caption?: string;
  category?: PhotoCategory | string | null;
  isCover: boolean;
  order: number;
}

/** Bekor qilish siyosati — mijoz bron paytida ko'radi. */
export enum CancellationPolicy {
  FLEXIBLE = "FLEXIBLE",
  MODERATE = "MODERATE",
  STRICT = "STRICT",
  NON_REFUNDABLE = "NON_REFUNDABLE",
}

/** Qo'shimcha to'lov (mehmonxonada to'lanadi). */
export interface ExtraFee {
  id: string;
  name: string;
  amount: number;
  /** Qanday tarzda hisoblanadi. */
  charge: "per_stay" | "per_night" | "per_person";
  required: boolean;
}

/** Yaqin diqqatga sazovor joy — mijozlarga joylashuvni tushuntirish. */
export interface NearbyPlace {
  id: string;
  name: string;
  /** Masalan: "500 m", "12 km" */
  distance: string;
}

/** Mehmonxona e'loni — mijozga ko'rinadigan hamma narsa. */
export interface Listing {
  status: ListingStatus;

  // Umumiy
  name: string;
  shortDescription: string;
  fullDescription: string;
  stars: number;

  // Rasmlar
  photos: ListingPhoto[];

  // Qulayliklar (id ro'yxati)
  amenities: string[];

  // Joylashuv
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  nearby: NearbyPlace[];

  // Uy qoidalari
  checkInTime: string; // "14:00"
  checkOutTime: string; // "12:00"
  cancellationPolicy: CancellationPolicy;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  childrenAllowed: boolean;
  extraFees: ExtraFee[];
  customRules: string[];
}

/** Qulaylik guruhi (UI'da bo'limlarga bo'lish uchun). */
export interface AmenityGroup {
  key: string;
  label: string;
  items: Array<{ id: string; label: string }>;
}

export const AMENITY_GROUPS: AmenityGroup[] = [
  {
    key: "internet",
    label: "Internet va texnika",
    items: [
      { id: "wifi", label: "Bepul Wi-Fi" },
      { id: "wifi_public", label: "Umumiy joylarda Wi-Fi" },
      { id: "workspace", label: "Ish stoli" },
      { id: "tv", label: "Televizor" },
    ],
  },
  {
    key: "food",
    label: "Ovqat va ichimlik",
    items: [
      { id: "breakfast", label: "Nonushta" },
      { id: "restaurant", label: "Restoran" },
      { id: "bar", label: "Bar" },
      { id: "minibar", label: "Mini-bar" },
      { id: "room_service", label: "Xonaga xizmat (24/7)" },
      { id: "kitchen", label: "Umumiy oshxona" },
    ],
  },
  {
    key: "wellness",
    label: "Sog'lomlashtirish",
    items: [
      { id: "pool", label: "Hovuz" },
      { id: "gym", label: "Fitness zal" },
      { id: "spa", label: "Spa" },
      { id: "sauna", label: "Sauna" },
      { id: "jacuzzi", label: "Jakuzi" },
    ],
  },
  {
    key: "services",
    label: "Xizmatlar",
    items: [
      { id: "reception_24", label: "24/7 resepsiyon" },
      { id: "concierge", label: "Konsyerj" },
      { id: "laundry", label: "Kir yuvish" },
      { id: "airport_shuttle", label: "Aeroport transferi" },
      { id: "car_rental", label: "Avtomobil ijarasi" },
      { id: "tour_desk", label: "Ekskursiya byurosi" },
    ],
  },
  {
    key: "facilities",
    label: "Umumiy",
    items: [
      { id: "parking", label: "Bepul parking" },
      { id: "elevator", label: "Lift" },
      { id: "ac", label: "Konditsioner" },
      { id: "heating", label: "Isitish tizimi" },
      { id: "garden", label: "Bog'" },
      { id: "terrace", label: "Terrasa" },
    ],
  },
  {
    key: "accessibility",
    label: "Xavfsizlik va qulaylik",
    items: [
      { id: "safe", label: "Seyf" },
      { id: "smoke_detector", label: "Tutun detektori" },
      { id: "fire_extinguisher", label: "O't o'chirgich" },
      { id: "wheelchair", label: "Nogironlar aravasi uchun" },
      { id: "family_friendly", label: "Oilaviylar uchun" },
    ],
  },
];

/** Restoran uchun umumiy qulayliklar (AMENITY_GROUPS'ning restoranga mos varianti). */
export const RESTAURANT_AMENITY_GROUPS: AmenityGroup[] = [
  {
    key: "food",
    label: "Taom va ichimlik",
    items: [
      { id: "halal", label: "Halol taomlar" },
      { id: "vegan", label: "Vegetarian/vegan menyu" },
      { id: "kids_menu", label: "Bolalar menyusi" },
      { id: "bar", label: "Bar" },
      { id: "alcohol", label: "Alkogolli ichimliklar" },
      { id: "hookah", label: "Kalyan" },
    ],
  },
  {
    key: "ambience",
    label: "Muhit va o'yin-kulgi",
    items: [
      { id: "live_music", label: "Jonli musiqa" },
      { id: "karaoke", label: "Karaoke" },
      { id: "outdoor_seating", label: "Ochiq terrasa" },
      { id: "private_room", label: "Alohida (VIP) zal" },
      { id: "kids_zone", label: "Bolalar zonasi" },
      { id: "tv_screens", label: "Sport translyatsiyasi (TV)" },
    ],
  },
  {
    key: "services",
    label: "Xizmatlar",
    items: [
      { id: "wifi", label: "Bepul Wi-Fi" },
      { id: "parking", label: "Bepul parking" },
      { id: "delivery", label: "Yetkazib berish" },
      { id: "takeaway", label: "Olib ketish" },
      { id: "reservation_required", label: "Oldindan bron talab qilinadi" },
      { id: "catering", label: "Ketering xizmati" },
    ],
  },
  {
    key: "facilities",
    label: "Qulayliklar",
    items: [
      { id: "ac", label: "Konditsioner" },
      { id: "smoking_area", label: "Chekish joyi" },
      { id: "wheelchair", label: "Nogironlar aravasi uchun" },
      { id: "family_friendly", label: "Oilaviylar uchun qulay" },
    ],
  },
];

/** Bekor qilish siyosati tavsifi (UI'da tanlash uchun). */
export const CANCELLATION_POLICY_INFO: Record<
  CancellationPolicy,
  { label: string; description: string }
> = {
  [CancellationPolicy.FLEXIBLE]: {
    label: "Erkin",
    description:
      "Kelish sanasidan 24 soat oldingacha bepul bekor qilish mumkin.",
  },
  [CancellationPolicy.MODERATE]: {
    label: "O'rta",
    description:
      "Kelish sanasidan 3 kun oldin bepul bekor qilish; keyin 50% qaytariladi.",
  },
  [CancellationPolicy.STRICT]: {
    label: "Qat'iy",
    description:
      "Kelish sanasidan 7 kun oldin bepul bekor qilish; keyin qaytarilmaydi.",
  },
  [CancellationPolicy.NON_REFUNDABLE]: {
    label: "Qaytarilmaydi",
    description: "Bron qilingandan keyin pul qaytarilmaydi. Chegirmali narx.",
  },
};

export const LISTING_STATUS_INFO: Record<
  ListingStatus,
  { label: string; description: string; tone: "warning" | "brand" | "accent" | "neutral" }
> = {
  [ListingStatus.DRAFT]: {
    label: "Qoralama",
    description: "To'ldirish davomida. Mijozlarga ko'rinmaydi.",
    tone: "neutral",
  },
  [ListingStatus.UNDER_REVIEW]: {
    label: "Ko'rib chiqilmoqda",
    description: "Admin tomonidan tekshirilmoqda. Mijozlarga ko'rinmaydi.",
    tone: "warning",
  },
  [ListingStatus.PUBLISHED]: {
    label: "Nashr qilingan",
    description: "Mijozlarga ko'rinadi va bron qilinadi.",
    tone: "accent",
  },
  [ListingStatus.HIDDEN]: {
    label: "Yashirilgan",
    description: "Vaqtincha yashirilgan. Mijozlarga ko'rinmaydi.",
    tone: "brand",
  },
};
