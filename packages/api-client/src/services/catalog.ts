import { rawApi } from "../client";
import { camelizeKeys } from "../case";
import type { Locale, CityOption, AmenityOption } from "../types";

export interface PopularCityView {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  hotelCount: number;
  sortOrder: number;
}

export interface DestinationView {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  link: string | null;
}

export interface PartnerShowcaseView {
  id: string;
  companyName: string;
  logoUrl: string;
  type: string;
  sortOrder: number;
}

export interface AttractionCatalogView {
  id: string;
  name: string;
  cityName: string;
  categoryKey: string;
  categoryDefault: string;
  description: string;
  rating: number;
  imageUrl: string;
  bestTimeToVisit: string;
  latitude?: number;
  longitude?: number;
}

export interface RestaurantCatalogView {
  id: string;
  name: string;
  cityName: string;
  address: string;
  cuisine: string;
  rating: number;
  reviewsCount: number;
  averageCheckSum: number;
  workingHours: string;
  imageUrl: string;
  phone: string;
}

export interface RestaurantDetailView {
  id: string;
  slug: string;
  name: string;
  description: string;
  cityName: string;
  address: string;
  workingHours: string;
  checkInTime?: string;
  checkOutTime?: string;
  phone: string;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  images: string[];
  tables: Array<{
    id: string;
    code: string;
    name: string;
    capacity: number;
    basePriceSum: number;
  }>;
}

export interface TransportCatalogView {
  id: string;
  name: string;
  cityName: string;
  categoryKey: string;
  categoryDefault: string;
  seats: number;
  hasDriver: boolean;
  fuelType: string;
  transmission: string;
  pricePerDaySum: number;
  rating: number;
  imageUrl: string;
  phone: string;
}

export interface TransportDetailView {
  id: string;
  name: string;
  cityName: string;
  categoryKey: string;
  categoryDefault: string;
  seats: number;
  hasDriver: boolean;
  fuelType: string;
  transmission: string;
  hasAc: boolean;
  luggageCapacityBags: number | null;
  plateNumber: string | null;
  pricePerDaySum: number;
  companyName: string;
  rating: number;
  reviewsCount: number;
  phone: string;
  imageUrl: string;
  images: string[];
}

type Localized = Partial<Record<Locale, string>> & Record<string, string>;
type LocalizedValue = Localized | string | undefined;

interface RawCatalogItem {
  id: string;
  name: Localized;
}

interface RawPopularCity {
  id: string;
  name: Localized;
  slug?: string;
  imageUrl?: string;
  hotelCount?: number;
  sortOrder?: number;
}

interface RawDestination {
  id: string;
  slug?: string;
  name?: LocalizedValue;
  imageUrl?: string;
  link?: string | null;
}

interface RawPartnerShowcase {
  id: string;
  companyName?: string;
  logoUrl?: string;
  type?: string;
  sortOrder?: number;
}

interface RawAttraction {
  id: string;
  name?: LocalizedValue;
  cityName?: LocalizedValue;
  categoryKey?: string;
  categoryDefault?: string;
  description?: LocalizedValue;
  rating?: number;
  imageUrl?: string;
  bestTimeToVisit?: LocalizedValue;
  latitude?: number | string;
  longitude?: number | string;
}

interface RawRestaurant {
  id: string;
  name?: LocalizedValue;
  cityName?: LocalizedValue;
  address?: string;
  cuisine?: string;
  rating?: number;
  reviewsCount?: number;
  averageCheck?: number;
  workingHours?: string;
  imageUrl?: string;
  phone?: string;
}

interface RawTransport {
  id: string;
  name?: string;
  cityName?: LocalizedValue;
  categoryKey?: string;
  categoryDefault?: string;
  seats?: number;
  hasDriver?: boolean;
  fuelType?: string;
  transmission?: string;
  pricePerDay?: number;
  rating?: number;
  imageUrl?: string;
  phone?: string;
}

function pickLocale(value: LocalizedValue, locale: Locale): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[locale] ?? value.uz ?? Object.values(value)[0] ?? "";
}

async function fetchCatalog(
  path: string,
  locale: Locale,
): Promise<Array<{ id: string; name: string }>> {
  const tag = path.includes("cities") ? "cities" : "amenities";
  const raw = await rawApi.get<unknown>(path, { 
    next: { revalidate: 3600, tags: ["catalog", tag] } 
  } as any);
  const items = camelizeKeys<RawCatalogItem[]>(raw);
  return (items ?? []).map((item) => ({
    id: item.id,
    name: pickLocale(item.name, locale),
  }));
}

export const catalogService = {
  /** `GET /catalog/cities` — qidiruv uchun shaharlar ro'yxati. */
  async getCities(locale: Locale): Promise<CityOption[]> {
    return fetchCatalog("/catalog/cities", locale);
  },

  /** `GET /catalog/amenities` — qulaylik id → nom (tilga moslangan). */
  async getAmenities(locale: Locale): Promise<AmenityOption[]> {
    return fetchCatalog("/catalog/amenities", locale);
  },

  /** `GET /catalog/destinations` — bosh sahifa uchun mashhur shaharlar (CMS Destinations). */
  async getPopularCities(locale: Locale): Promise<PopularCityView[]> {
    const raw = await rawApi.get<unknown>("/catalog/destinations", {
      next: { revalidate: 3600, tags: ["catalog", "destinations"] },
    } as any);
    const items = camelizeKeys<any[]>(raw);
    return (items ?? []).map((item) => {
      const title = item.title ?? {};
      const metadata = item.metadata ?? {};
      return {
        id: item.id,
        name: pickLocale(title, locale) || item.slug || "",
        slug: item.slug ?? "",
        imageUrl: metadata.imageUrl ?? metadata.image_url ?? "",
        hotelCount: 0, // No longer directly available in CMS entries, but we can mock it or UI can hide it.
        sortOrder: metadata.order ?? metadata.sortOrder ?? metadata.sort_order ?? 0,
      };
    });
  },

  /**
   * `GET /catalog/destinations` — admin panelda boshqariladigan "Mashhur
   * yo'nalishlar" (bosh sahifa). Faqat admin `faol` qilib belgilagan va
   * tartiblagan yozuvlar qaytadi — backend allaqachon `status`ga qarab
   * filtrlaydi va `order`ga qarab saralaydi, shuning uchun bu yerda
   * qo'shimcha filtr/sort kerak emas.
   */
  async getDestinations(locale: Locale): Promise<DestinationView[]> {
    const raw = await rawApi.get<unknown>("/catalog/destinations", {
      next: { revalidate: 300 },
    } as any);
    const items = camelizeKeys<RawDestination[]>(raw);
    return (items ?? []).map((item) => ({
      id: item.id,
      slug: item.slug ?? "",
      name: pickLocale(item.name, locale),
      imageUrl: item.imageUrl ?? "",
      link: item.link ?? null,
    }));
  },

  /** `GET /catalog/partners-showcase` — bosh sahifa uchun hamkor logolari. */
  async getPartnersShowcase(): Promise<PartnerShowcaseView[]> {
    const raw = await rawApi.get<unknown>("/catalog/partners-showcase", {
      next: { revalidate: 3600 },
    } as any);
    const items = camelizeKeys<RawPartnerShowcase[]>(raw);
    return (items ?? []).map((item) => ({
      id: item.id,
      companyName: item.companyName ?? "",
      logoUrl: item.logoUrl ?? "",
      type: item.type ?? "",
      sortOrder: item.sortOrder ?? 0,
    }));
  },

  async getAttractions(locale: Locale): Promise<AttractionCatalogView[]> {
    const raw = await rawApi.get<unknown>("/catalog/attractions", {
      next: { revalidate: 3600 },
    } as any);
    const items = camelizeKeys<RawAttraction[]>(raw);
    return (items ?? []).map((item) => ({
      id: item.id,
      name: pickLocale(item.name, locale),
      cityName: pickLocale(item.cityName, locale),
      categoryKey: item.categoryKey ?? "",
      categoryDefault: item.categoryDefault ?? "",
      description: pickLocale(item.description, locale),
      rating: Number(item.rating ?? 0),
      imageUrl: item.imageUrl ?? "",
      bestTimeToVisit: pickLocale(item.bestTimeToVisit, locale),
      latitude: item.latitude != null ? Number(item.latitude) : undefined,
      longitude: item.longitude != null ? Number(item.longitude) : undefined,
    }));
  },

  async getRestaurants(locale: Locale): Promise<RestaurantCatalogView[]> {
    const raw = await rawApi.get<unknown>("/catalog/restaurants", {
      cache: "no-store",
    } as any);
    const items = camelizeKeys<RawRestaurant[]>(raw);
    return (items ?? []).map((item) => ({
      id: item.id,
      name: pickLocale(item.name, locale),
      cityName: pickLocale(item.cityName, locale),
      address: item.address ?? "",
      cuisine: item.cuisine ?? "",
      rating: Number(item.rating ?? 0),
      reviewsCount: Number(item.reviewsCount ?? 0),
      averageCheckSum: Number(item.averageCheck ?? 0),
      workingHours: item.workingHours ?? "",
      imageUrl: item.imageUrl ?? "",
      phone: item.phone ?? "",
    }));
  },

  async getRestaurant(idOrSlug: string, locale: Locale): Promise<RestaurantDetailView> {
    const raw = await rawApi.get<unknown>(`/restaurants/${encodeURIComponent(idOrSlug)}`, {
      cache: "no-store",
    } as any);
    const item = camelizeKeys<any>(raw);
    return {
      id: item.id,
      slug: item.slug ?? "",
      name: pickLocale(item.name, locale),
      description: pickLocale(item.description, locale),
      cityName: pickLocale(item.city?.name ?? item.cityName, locale),
      address: item.address ?? "",
      workingHours: item.workingHours ?? "",
      checkInTime: item.checkInTime ?? "",
      checkOutTime: item.checkOutTime ?? "",
      phone: item.phone ?? "",
      rating: Number(item.rating ?? 0),
      reviewsCount: Number(item.reviewsCount ?? 0),
      imageUrl: item.imageUrl ?? "",
      images: Array.isArray(item.images) ? item.images : [],
      tables: Array.isArray(item.tables)
        ? item.tables.map((t: any) => ({
            id: t.id,
            code: t.code,
            name: t.name ?? `Stol № ${t.code}`,
            capacity: Number(t.capacity ?? 4),
            basePriceSum: Number(t.basePrice ?? 0),
          }))
        : [],
    };
  },

  async getTransports(
    locale: Locale,
    options?: { checkIn?: string; checkOut?: string },
  ): Promise<TransportCatalogView[]> {
    const searchParams: Record<string, string> = {};
    if (options?.checkIn) searchParams.check_in = options.checkIn;
    if (options?.checkOut) searchParams.check_out = options.checkOut;
    const raw = await rawApi.get<unknown>("/catalog/transports", {
      cache: "no-store",
      searchParams,
    } as any);
    const items = camelizeKeys<RawTransport[]>(raw);
    return (items ?? []).map((item) => ({
      id: item.id,
      name: item.name ?? "",
      cityName: pickLocale(item.cityName, locale),
      categoryKey: item.categoryKey ?? "",
      categoryDefault: item.categoryDefault ?? "",
      seats: Number(item.seats ?? 0),
      hasDriver: Boolean(item.hasDriver),
      fuelType: item.fuelType ?? "",
      transmission: item.transmission ?? "",
      // `vehicles.price_per_day` so'mda saqlanadi (hamkor panelida to'g'ridan-
      // to'g'ri so'm kiritiladi, tiyinga aylantirish yo'q) — boshqa narx
      // maydonlaridan farqli, bu yerda `tiyinToSum` qo'llash NOTO'G'RI bo'lardi.
      pricePerDaySum: Number(item.pricePerDay ?? 0),
      rating: Number(item.rating ?? 0),
      imageUrl: item.imageUrl ?? "",
      phone: item.phone ?? "",
    }));
  },

  async getTransport(id: string, locale: Locale): Promise<TransportDetailView> {
    const raw = await rawApi.get<unknown>(`/catalog/transports/${encodeURIComponent(id)}`, {
      cache: "no-store",
    } as any);
    const item = camelizeKeys<any>(raw);
    return {
      id: item.id,
      name: item.name ?? "",
      cityName: pickLocale(item.cityName, locale),
      categoryKey: item.categoryKey ?? "",
      categoryDefault: item.categoryDefault ?? "",
      seats: Number(item.seats ?? 0),
      hasDriver: Boolean(item.hasDriver),
      fuelType: item.fuelType ?? "",
      transmission: item.transmission ?? "",
      hasAc: Boolean(item.hasAc),
      luggageCapacityBags:
        item.luggageCapacityBags == null ? null : Number(item.luggageCapacityBags),
      plateNumber: item.plateNumber ?? null,
      pricePerDaySum: Number(item.pricePerDay ?? 0),
      companyName: item.companyName ?? "",
      rating: Number(item.rating ?? 0),
      reviewsCount: Number(item.reviewsCount ?? 0),
      phone: item.phone ?? "",
      imageUrl: item.imageUrl ?? "",
      images: Array.isArray(item.images) ? item.images : [],
    };
  },
};
