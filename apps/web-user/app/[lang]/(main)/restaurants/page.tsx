import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/api";
import { RestaurantsView } from "@/components/features/restaurants/RestaurantsView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [commonDict, restaurantsDict] = await Promise.all([
    getDictionary(lang as Locale, "common"),
    getDictionary(lang as Locale, "restaurants"),
  ]);
  const heroMap = await api.heroBackgrounds.getHeroMap().catch(() => ({} as any));
  const heroData = heroMap["restaurants"];
  
  const backendTitle = heroData ? (typeof heroData.title === "object" ? heroData.title?.[lang as Locale] : heroData.titleText) : undefined;
  const backendSubtitle = heroData ? (typeof heroData.subtitle === "object" ? heroData.subtitle?.[lang as Locale] : heroData.subtitleText) : undefined;
  
  const title = backendTitle || commonDict.nav.restaurants;
  const description = backendSubtitle || restaurantsDict.subtitle;

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

export default async function RestaurantsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const [restaurantsDict, restaurants, heroMap] = await Promise.all([
    getDictionary(locale, "restaurants"),
    api.catalog.getRestaurants(locale),
    api.heroBackgrounds.getHeroMap(),
  ]);

  const restaurantsHero = heroMap["restaurants"];
  const heroBg = restaurantsHero ? {
    imageUrl: restaurantsHero.imageUrl,
    title: typeof restaurantsHero.title === "object" ? restaurantsHero.title?.[locale] : restaurantsHero.titleText,
    subtitle: typeof restaurantsHero.subtitle === "object" ? restaurantsHero.subtitle?.[locale] : restaurantsHero.subtitleText,
  } : undefined;

  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div>Loading...</div>}>
        <RestaurantsView dict={restaurantsDict} items={restaurants} locale={locale} heroBg={heroBg} />
      </Suspense>
    </main>
  );
}
