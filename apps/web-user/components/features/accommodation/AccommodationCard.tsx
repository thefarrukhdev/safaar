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

  const trans = {
    uz: { breakfast: "Nonushta", parking: "Parking", restaurant: "Restoran", spa: "Spa" },
    ru: { breakfast: "Завтрак", parking: "Парковка", restaurant: "Ресторан", spa: "Спа" },
    en: { breakfast: "Breakfast", parking: "Parking", restaurant: "Restaurant", spa: "Spa" },
  }[locale] || { breakfast: "Breakfast", parking: "Parking", restaurant: "Restaurant", spa: "Spa" };

  const amenityPills = hotel.name.toLowerCase().includes("chimgan")
    ? ["Wi-Fi", trans.breakfast, trans.parking]
    : hotel.name.toLowerCase().includes("buxoro")
    ? ["Wi-Fi", trans.breakfast, trans.restaurant]
    : ["Wi-Fi", trans.breakfast, trans.spa];

  const perNight = labels.perNight ?? DEFAULT_PER_NIGHT[locale] ?? "kecha";
  const price = hotel.minPriceSum > 0 ? hotel.minPriceSum : undefined;
  const actionLabel = locale === "ru" ? "Подробнее" : locale === "en" ? "Details" : "Batafsil";

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
      price={price ? { amount: price, period: `1 ${perNight}` } : undefined}
      locale={locale}
      actionLabel={actionLabel}
    />
  );
}


