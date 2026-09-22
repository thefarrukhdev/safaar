import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/api";
import { SearchBar } from "@/components/search/SearchBar";
import { Hero } from "@/components/features/home/Hero";
import { CityCardsSection } from "@/components/features/home/CityCardsSection";

import { FeaturedHotelsCarousel } from "@/components/features/home/FeaturedHotelsCarousel";
import { DealsSection, type DealItem } from "@/components/features/home/DealsSection";
import { BannerStrip } from "@/components/features/home/BannerStrip";
import { Skeleton } from "@/components/ui/Skeleton";
import { buttonVariants } from "@/components/ui/button-variants";
import { CityPills } from "@/components/features/home/CityPills";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang, "home");
  return { title: dict.hero.title, description: dict.hero.subtitle };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const [common, dict, cities, featuredResult, rawDeals, publicStats, banners] = await Promise.all([
    getDictionary(locale, "common"),
    getDictionary(locale, "home"),
    api.catalog.getCities(locale),
    api.hotels.getFeaturedHotels(locale, { limit: 10 }),
    api.cms.getDeals(locale),
    api.cms.getPublicStats().catch(() => null),
    api.cms.getBanners(locale).catch(() => []),
  ]);

  const hotels = [...featuredResult.items];
  const bannerUrl = banners[0]?.imageUrl || undefined;

  const deals: DealItem[] = rawDeals.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    cityName: d.cityName,
    imageUrl: d.imageUrl,
    oldPriceSum: d.oldPriceSum,
    newPriceSum: d.newPriceSum,
    discountPercent: d.discountPercent,
    endsAt: d.endsAt,
  }));


  return (
    <main className="relative flex flex-1 flex-col bg-white text-slate-900">
      {/* EKRAN 1: Hero + SearchBar + Featured Hotels */}
      <div className="flex min-h-svh flex-col justify-between">
        <div className="relative z-30 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both w-full" style={{ animationDelay: "0ms" }}>
          <Hero dict={dict.hero} bannerUrl={bannerUrl}>
            <div className="w-full space-y-4">
              <SearchBar locale={locale} dict={common.search} cities={cities} />
              {cities.length > 0 && (
                <CityPills cities={cities} locale={locale} />
              )}
            </div>
          </Hero>
        </div>

        <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both w-full" style={{ animationDelay: "150ms" }}>
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <FeaturedHotelsCarousel
              hotels={hotels}
              dict={dict.featured}
              locale={locale}
            />
          </Suspense>
        </div>
      </div>

      {banners.length > 0 && (
        <div className="py-8 sm:py-10 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: "300ms" }}>
          <BannerStrip banners={banners} locale={locale} />
        </div>
      )}

      {/* EKRAN 2: Chegirmadagi takliflar */}
      <div className="py-10 sm:py-14 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: "450ms" }}>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <DealsSection deals={deals} dict={dict.deals} locale={locale} />
        </Suspense>
      </div>

      {/* EKRAN 4: City Cards */}
      <div className="py-10 sm:py-16 md:py-20 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: "600ms" }}>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <CityCardsSection locale={locale} dict={dict.popularCities} />
        </Suspense>
      </div>
    </main>
  );
}
