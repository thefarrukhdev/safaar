import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AccommodationPage } from "@/components/accommodation/AccommodationPage";
import { api } from "@/lib/api";

export type AccommodationRouteKey =
  | "hotels"
  | "dachas"
  | "sanatoriums"
  | "resorts";

export async function generateAccommodationMetadata(
  lang: string,
  key: AccommodationRouteKey
): Promise<Metadata> {
  if (!isLocale(lang)) return {};
  const common = await getDictionary(lang as Locale, "common");
  const defaultTitle = key === "hotels"
    ? (await getDictionary(lang as Locale, "hotels")).title
    : (common.nav as Record<string, string>)[key] ?? key;
    
  const heroMap = await api.heroBackgrounds.getHeroMap().catch(() => ({} as any));
  const heroData = heroMap[key];

  const backendTitle = heroData ? (typeof heroData.title === "object" ? heroData.title?.[lang as Locale] : heroData.titleText) : undefined;
  const backendSubtitle = heroData ? (typeof heroData.subtitle === "object" ? heroData.subtitle?.[lang as Locale] : heroData.subtitleText) : undefined;
  
  const title = backendTitle || defaultTitle;
  const description = backendSubtitle || undefined;

  const metadata: Metadata = {
    title,
    description,
  };

  if (heroData?.imageUrl) {
    metadata.openGraph = {
      images: [{ url: heroData.imageUrl }],
    };
  }

  return metadata;
}

export async function renderAccommodationRoute(
  lang: string,
  searchParams: Record<string, string | string[] | undefined>,
  key: AccommodationRouteKey
) {
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const common = await getDictionary(locale, "common");
  const title = key === "hotels"
    ? (await getDictionary(locale, "hotels")).title
    : (common.nav as Record<string, string>)[key] ?? key;

  // Define the backend types expected
  // 'hotels' shows everything by default (or specific hotel type if needed later)
  const accommodationType =
    key === "dachas"
      ? "dacha"
      : key === "sanatoriums"
      ? "sanatorium"
      : key === "resorts"
      ? "resort"
      : undefined;

  return (
    <AccommodationPage
      locale={locale}
      searchParams={searchParams}
      basePath={`/${locale}/${key}`}
      title={title}
      type={accommodationType}
    />
  );
}
