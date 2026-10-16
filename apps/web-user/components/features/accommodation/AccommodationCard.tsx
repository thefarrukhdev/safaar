"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Locale } from "@/i18n/config";
import type { FavoritesDict } from "@/i18n/dictionaries";
import { resolveImage } from "@/lib/images";
import type { HotelListItem } from "@/types/view";
import { UniversalCard } from "@/components/ui/UniversalCard";
import {
  addFavoriteAction,
  removeFavoriteAction,
} from "@/lib/account/favorites-actions";

// labels ixtiyoriy (optional) — bosh sahifa karuseli uchun
// uzatilmasa, til bo'yicha default qiymat ishlatiladi
export interface AccommodationCardLabels {
  perNight?: string;
  reviews?: string;
}

/** Sevimlilar bo'yicha kontekst — ro'yxat sahifasi bitta so'rovda hisoblab,
 * har bir kartaga uzatadi (N+1 GET /me/favorites'ning oldini olish uchun). */
export interface AccommodationFavoritesContext {
  authed: boolean;
  loginHref: string;
  dict?: FavoritesDict;
  /** hotel.id -> favorite id */
  ids: Record<string, string>;
}

const DEFAULT_PER_NIGHT: Record<string, string> = {
  uz: "kecha",
  ru: "ночь",
  en: "night",
};

const FALLBACK_FAVORITE_ERROR: Record<string, string> = {
  uz: "Xatolik yuz berdi. Qayta urinib ko'ring.",
  ru: "Произошла ошибка. Попробуйте еще раз.",
  en: "Something went wrong. Please try again.",
};

const AMENITY_LABELS: Record<string, Record<string, string>> = {
  uz: {
    wifi: "Wi-Fi",
    wifi_public: "Wi-Fi",
    hotel_wifi: "Wi-Fi",
    dacha_wifi: "Wi-Fi",
    restaurant_wifi: "Wi-Fi",
    hotel_2: "Wi-Fi",

    tv: "Televizor",
    hotel_3: "Televizor",

    bed: "Karavot",
    hotel_4: "Karavot",

    breakfast: "Nonushta",
    parking: "Parking",
    restaurant_avtomobil_turar_joyi: "Parking",
    pool: "Hovuz",
    dacha_hovuz: "Hovuz",
    spa: "Spa",
    gym: "Sport zal",
    restaurant: "Restoran",
    bar: "Bar",
    ac: "Konditsioner",
    sauna: "Sauna",
    kitchen: "Oshxona",
    family_friendly: "Oilaviy",
    workspace: "Ish stoli",
    minibar: "Mini-bar",
    room_service: "Xona xizmati",
    jacuzzi: "Jakuzi",
    reception_24: "24/7 Resepshn",
    elevator: "Lift",
    dacha_ps: "PlayStation",
    restaurant_choy_bepul: "Bepul choy",
    restaurant_lux: "VIP zona",
  },
  ru: {
    wifi: "Wi-Fi",
    wifi_public: "Wi-Fi",
    hotel_wifi: "Wi-Fi",
    dacha_wifi: "Wi-Fi",
    restaurant_wifi: "Wi-Fi",
    hotel_2: "Wi-Fi",

    tv: "Телевизор",
    hotel_3: "Телевизор",

    bed: "Кровать",
    hotel_4: "Кровать",

    breakfast: "Завтрак",
    parking: "Парковка",
    restaurant_avtomobil_turar_joyi: "Парковка",
    pool: "Бассейн",
    dacha_hovuz: "Бассейн",
    spa: "Спа",
    gym: "Тренажерный зал",
    restaurant: "Ресторан",
    bar: "Бар",
    ac: "Кондиционер",
    sauna: "Сауна",
    kitchen: "Кухня",
    family_friendly: "Для семей",
    workspace: "Рабочий стол",
    minibar: "Мини-бар",
    room_service: "Обслуживание в номер",
    jacuzzi: "Джакузи",
    reception_24: "Ресепшн 24/7",
    elevator: "Лифт",
    dacha_ps: "PlayStation",
    restaurant_choy_bepul: "Бесплатный чай",
    restaurant_lux: "VIP зона",
  },
  en: {
    wifi: "Wi-Fi",
    wifi_public: "Wi-Fi",
    hotel_wifi: "Wi-Fi",
    dacha_wifi: "Wi-Fi",
    restaurant_wifi: "Wi-Fi",
    hotel_2: "Wi-Fi",

    tv: "TV",
    hotel_3: "TV",

    bed: "Bed",
    hotel_4: "Bed",

    breakfast: "Breakfast",
    parking: "Parking",
    restaurant_avtomobil_turar_joyi: "Parking",
    pool: "Pool",
    dacha_hovuz: "Pool",
    spa: "Spa",
    gym: "Gym",
    restaurant: "Restaurant",
    bar: "Bar",
    ac: "AC",
    sauna: "Sauna",
    kitchen: "Kitchen",
    family_friendly: "Family friendly",
    workspace: "Workspace",
    minibar: "Mini-bar",
    room_service: "Room service",
    jacuzzi: "Jacuzzi",
    reception_24: "24/7 Reception",
    elevator: "Elevator",
    dacha_ps: "PlayStation",
    restaurant_choy_bepul: "Free tea",
    restaurant_lux: "VIP area",
  },
};

export function AccommodationCard({
  hotel,
  locale,
  labels = {},
  favorites,
}: {
  hotel: HotelListItem;
  locale: Locale;
  labels?: AccommodationCardLabels;
  favorites?: AccommodationFavoritesContext;
}) {
  const router = useRouter();
  const imageUrl = resolveImage(hotel.imageUrl);
  const [favoriteId, setFavoriteId] = useState<string | null>(
    favorites?.ids[hotel.id] ?? null,
  );

  const favoriteErrorMessage =
    favorites?.dict?.error ??
    FALLBACK_FAVORITE_ERROR[locale] ??
    FALLBACK_FAVORITE_ERROR.uz;
  const loginHref = favorites?.loginHref ?? `/${locale}/login`;

  async function handleFavoriteToggle(nextState: boolean) {
    if (favorites && !favorites.authed) {
      router.push(loginHref);
      return;
    }

    if (nextState) {
      const res = await addFavoriteAction("hotel", hotel.id);
      if (res.ok && res.id) {
        setFavoriteId(res.id);
      } else {
        setFavoriteId(null);
        if (res.authRequired) {
          router.push(loginHref);
        } else {
          toast.error(favoriteErrorMessage);
        }
      }
    } else {
      const idToRemove = favoriteId;
      if (!idToRemove) return;
      const res = await removeFavoriteAction(idToRemove);
      if (res.ok) {
        setFavoriteId(null);
      } else {
        setFavoriteId(idToRemove);
        if (res.authRequired) {
          router.push(loginHref);
        } else {
          toast.error(favoriteErrorMessage);
        }
      }
    }
  }

  const labelsMap = AMENITY_LABELS[locale] || AMENITY_LABELS.uz;
  const rawPills = (hotel.amenities && hotel.amenities.length > 0)
    ? Array.from(
        new Set(
          hotel.amenities
            .map((code) => {
              const key = String(code).toLowerCase().trim();
              if (labelsMap[key]) return labelsMap[key];
              // Filter out unmapped technical IDs like hotel_12, dacha_99, or UUIDs
              if (/^[a-z]+_\d+$/i.test(key) || /^[0-9a-f-]{36}$/i.test(key)) {
                return null;
              }
              const clean = key.replace(/^[a-z]+_/i, "").replace(/_/g, " ");
              return clean.charAt(0).toUpperCase() + clean.slice(1);
            })
            .filter((label): label is string => Boolean(label)),
        ),
      ).slice(0, 3)
    : [];

  const amenityPills = rawPills.length > 0 ? rawPills : ["Wi-Fi"];

  const perNight = labels.perNight ?? DEFAULT_PER_NIGHT[locale] ?? "kecha";
  const price = hotel.minPriceSum > 0 ? hotel.minPriceSum : undefined;
  const oldPrice = hotel.baseMinPriceSum && hotel.discountAmount && hotel.discountAmount > 0 ? hotel.baseMinPriceSum : undefined;
  const discountPercent = oldPrice && hotel.discountAmount ? Math.round((hotel.discountAmount / oldPrice) * 100) : 0;
  
  const actionLabel = locale === "ru" ? "Подробнее" : locale === "en" ? "Details" : "Batafsil";

  const discountBadge = discountPercent > 0 ? (
    <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white shadow-sm">
      -{discountPercent}%
    </span>
  ) : undefined;

  return (
    <UniversalCard
      imageSrc={imageUrl}
      imageAlt={hotel.name}
      showFavorite
      isFavorite={!!favoriteId}
      onFavoriteToggle={handleFavoriteToggle}
      title={hotel.name}
      location={hotel.cityName}
      tags={amenityPills}
      href={`/${locale}/hotels/${hotel.slug}`}
      topLeft={discountBadge}
      price={price ? { amount: price, oldAmount: oldPrice, period: `1 ${perNight}` } : undefined}
      locale={locale}
      actionLabel={actionLabel}
    />
  );
}


