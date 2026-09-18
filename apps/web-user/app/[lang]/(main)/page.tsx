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
import { Building2, MapPin, Star, Headset } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export const dynamic = "force-dynamic";

function TrustStats({ dict, publicStats }: { dict: any; publicStats: any }) {
  const stats = [
    {
      icon: Building2,
      value: publicStats?.hotels || dict.hotels,
      label: dict.hotelsLabel,
    },
    {
      icon: MapPin,
      value: publicStats?.cities || dict.cities,
      label: dict.citiesLabel,
    },
    {
      icon: Star,
      value: publicStats?.rating || dict.rating,
      label: dict.ratingLabel,
    },
    {
      icon: Headset,
      value: publicStats?.support || dict.support,
      label: dict.supportLabel,
    },
  ];

  return (
    <section className="bg-white border-y border-slate-200 py-10 sm:py-14 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: "300ms" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 sm:gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              <stat.icon className="h-6 w-6 text-primary-600 mb-3" />
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {stat.value}
              </div>
              <div className="text-sm text-slate-500 font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials({ dict }: { dict: any }) {
  const reviews = dict.items || [];
  
  return (
    <section className="py-10 sm:py-14 max-w-7xl mx-auto px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both" style={{ animationDelay: "750ms" }}>
      <SectionHeader title={dict.title} />
      
      {/* Mobile: horizontal scroll */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 scrollbar-none sm:hidden pb-4">
        {reviews.map((r: any, i: number) => (
          <div key={i} className="w-[85vw] max-w-[320px] shrink-0 bg-white rounded-2xl border border-slate-200 p-5 snap-center">
            <div className="flex gap-1 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-accent-500 text-accent-500" />
              ))}
            </div>
            <p className="text-sm text-slate-600 italic mb-4">"{r.text}"</p>
            <div className="font-bold text-slate-900">{r.name}</div>
          </div>
        ))}
      </div>

      {/* Desktop: grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {reviews.map((r: any, i: number) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <div>
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent-500 text-accent-500" />
                ))}
              </div>
              <p className="text-sm text-slate-600 italic mb-4">"{r.text}"</p>
            </div>
            <div className="font-bold text-slate-900">{r.name}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

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
            <div className="w-full">
              <section id="search-section" className="bg-transparent pb-4 sm:pb-6">
                <div className="mx-auto max-w-5xl px-4 sm:px-6">
                  <SearchBar locale={locale} dict={common.search} cities={cities} />
                </div>
              </section>

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
