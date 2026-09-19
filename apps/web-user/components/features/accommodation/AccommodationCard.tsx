"use client";

import type { Locale } from "@/i18n/config";
import { resolveImage } from "@/lib/images";
import type { HotelListItem } from "@/types/view";
import { UniversalCard } from "@/components/ui/UniversalCard";

// labels ixtiyoriy (optional) — bosh sahifa karuseli uchun
// uzatilmasa, til bo'yicha default qiymat ishlatiladi
export interface AccommodationCardLabels {
  perNight?: string;
  reviews?: string;
}

const DEFAULT_PER_NIGHT: Record<string, string> = {
  uz: "kecha",
  ru: "ночь",
  en: "night",
};

export function AccommodationCard({
  hotel,
  locale,
  labels = {},
}: {
  hotel: HotelListItem;
  locale: Locale;
  labels?: AccommodationCardLabels;
}) {
  const imageUrl = resolveImage(hotel.imageUrl);

  const amenityPills = hotel.name.toLowerCase().includes("chimgan")
    ? ["Wi-Fi", "Nonushta", "Parking"]
    : hotel.name.toLowerCase().includes("buxoro")
    ? ["Wi-Fi", "Nonushta", "Restoran"]
    : ["Wi-Fi", "Nonushta", "Spa"];

  const perNight = labels.perNight ?? DEFAULT_PER_NIGHT[locale] ?? "kecha";
  const price = hotel.minPriceSum > 0 ? hotel.minPriceSum : undefined;
  const actionLabel = locale === "ru" ? "Подробнее" : locale === "en" ? "Details" : "Batafsil";

  return (
    <UniversalCard
      imageSrc={imageUrl}
      imageAlt={hotel.name}
      showFavorite
      title={hotel.name}
      location={hotel.cityName}
      tags={amenityPills}
      href={`/${locale}/hotels/${hotel.slug}`}
      price={price ? { amount: price, period: `1 ${perNight}` } : undefined}
      actionLabel={actionLabel}
    />
  );
}


