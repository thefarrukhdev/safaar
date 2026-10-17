/**
 * Tarjima lug'atlarini yuklash.
 *
 * Tamoyil: **har bir sahifa (yoki bo'lim) uchun alohida JSON namespace**.
 * Masalan `common` (umumiy: header/footer), `home` (bosh sahifa). Yangi sahifa
 * qo'shsangiz: `locales/<lang>/<sahifa>.json` yarating va shu registratsiyaga
 * qator qo'shing.
 *
 * Lug'atlar faqat serverda yuklanadi (`server-only`) — JSON hajmi mijoz
 * bundle'iga tushmaydi.
 */
import "server-only";
import type { Locale } from "./config";

const loaders = {
  uz: {
    common: () => import("@/locales/uz/common.json"),
    home: () => import("@/locales/uz/home.json"),
    hotels: () => import("@/locales/uz/hotels.json"),
    hotelDetail: () => import("@/locales/uz/hotelDetail.json"),
    auth: () => import("@/locales/uz/auth.json"),
    checkout: () => import("@/locales/uz/checkout.json"),
    booking: () => import("@/locales/uz/booking.json"),
    account: () => import("@/locales/uz/account.json"),
    static: () => import("@/locales/uz/static.json"),
    reviews: () => import("@/locales/uz/reviews.json"),
    favorites: () => import("@/locales/uz/favorites.json"),
    errors: () => import("@/locales/uz/errors.json"),
    catalog: () => import("@/locales/uz/catalog.json"),
    restaurants: () => import("@/locales/uz/restaurants.json"),
    attractions: () => import("@/locales/uz/attractions.json"),
    transport: () => import("@/locales/uz/transport.json"),
  },
  ru: {
    common: () => import("@/locales/ru/common.json"),
    home: () => import("@/locales/ru/home.json"),
    hotels: () => import("@/locales/ru/hotels.json"),
    hotelDetail: () => import("@/locales/ru/hotelDetail.json"),
    auth: () => import("@/locales/ru/auth.json"),
    checkout: () => import("@/locales/ru/checkout.json"),
    booking: () => import("@/locales/ru/booking.json"),
    account: () => import("@/locales/ru/account.json"),
    static: () => import("@/locales/ru/static.json"),
    reviews: () => import("@/locales/ru/reviews.json"),
    favorites: () => import("@/locales/ru/favorites.json"),
    errors: () => import("@/locales/ru/errors.json"),
    catalog: () => import("@/locales/ru/catalog.json"),
    restaurants: () => import("@/locales/ru/restaurants.json"),
    attractions: () => import("@/locales/ru/attractions.json"),
    transport: () => import("@/locales/ru/transport.json"),
  },
  en: {
    common: () => import("@/locales/en/common.json"),
    home: () => import("@/locales/en/home.json"),
    hotels: () => import("@/locales/en/hotels.json"),
    hotelDetail: () => import("@/locales/en/hotelDetail.json"),
    auth: () => import("@/locales/en/auth.json"),
    checkout: () => import("@/locales/en/checkout.json"),
    booking: () => import("@/locales/en/booking.json"),
    account: () => import("@/locales/en/account.json"),
    static: () => import("@/locales/en/static.json"),
    reviews: () => import("@/locales/en/reviews.json"),
    favorites: () => import("@/locales/en/favorites.json"),
    errors: () => import("@/locales/en/errors.json"),
    catalog: () => import("@/locales/en/catalog.json"),
    restaurants: () => import("@/locales/en/restaurants.json"),
    attractions: () => import("@/locales/en/attractions.json"),
    transport: () => import("@/locales/en/transport.json"),
  },
} as const;

export type Namespace = keyof (typeof loaders)["uz"];

type DictModule<NS extends Namespace> = Awaited<
  ReturnType<(typeof loaders)["uz"][NS]>
>;
type Dict<NS extends Namespace> = DictModule<NS> extends { default: infer D }
  ? D
  : DictModule<NS>;

/** Komponent props'larida ishlatish uchun lug'at turlari. */
export type CommonDict = Dict<"common">;
export type HomeDict = Dict<"home">;
export type HotelsDict = Dict<"hotels">;
export type HotelDetailDict = Dict<"hotelDetail">;
export type AuthDict = Dict<"auth">;
export type CheckoutDict = Dict<"checkout">;
export type BookingDict = Dict<"booking">;
export type AccountDict = Dict<"account">;
export type StaticDict = Dict<"static">;
export type ReviewsDict = Dict<"reviews">;
export type FavoritesDict = Dict<"favorites">;
export type ErrorsDict = Dict<"errors">;
export type CatalogDict = Dict<"catalog">;
export type RestaurantsDict = Dict<"restaurants">;
export type AttractionsDict = Dict<"attractions">;
export type TransportDict = Dict<"transport">;

function isPlainObject(item: unknown): item is Record<string, unknown> {
  return typeof item === "object" && item !== null && !Array.isArray(item);
}

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const output: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = output[key];
    if (isPlainObject(sVal) && isPlainObject(tVal)) {
      output[key] = deepMerge(tVal, sVal);
    } else if (sVal !== undefined && sVal !== null) {
      output[key] = sVal;
    }
  }
  return output as T;
}

async function fetchRemoteDictionary(
  locale: Locale,
  namespace: string,
): Promise<Record<string, unknown> | null> {
  const baseUrl = (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://api.safaar.uz/v1"
  ).replace(/\/+$/, "");

  const url = `${baseUrl}/translations/${encodeURIComponent(locale)}/${encodeURIComponent(namespace)}`;

  try {
    const res = await fetch(url, {
      next: {
        revalidate: 3600,
        tags: ["translations", `translation:${locale}:${namespace}`],
      },
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getDictionary<NS extends Namespace>(
  locale: Locale,
  namespace: NS,
): Promise<Dict<NS>> {
  const mod = await loaders[locale][namespace]();
  const local = ("default" in mod ? mod.default : mod) as Dict<NS>;

  try {
    const remote = await fetchRemoteDictionary(locale, String(namespace));
    if (remote && Object.keys(remote).length > 0) {
      return deepMerge(
        local as unknown as Record<string, unknown>,
        remote,
      ) as unknown as Dict<NS>;
    }
  } catch {
    // Fail silently and use bundled local dictionary
  }

  return local;
}

