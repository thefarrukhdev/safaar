import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/api";
import { SearchBar } from "@/components/search/SearchBar";
import { HotelFilters } from "@/components/hotels/HotelFilters";
import { HotelSortSelect } from "@/components/hotels/HotelSortSelect";
import { ActiveFilters } from "@/components/hotels/ActiveFilters";
import { Button } from "@/components/ui/Button";
import { AccommodationCategoryTabs } from "@/components/features/accommodation/AccommodationCategoryTabs";
import { AccommodationListWithMap } from "@/components/features/accommodation/AccommodationListWithMap";
import type { HotelListItem } from "@/types/view";

const PAGE_SIZE = 9;
const SORTS = ["price_asc", "price_desc", "rating"] as const;
type Sort = (typeof SORTS)[number];

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function int(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export interface AccommodationPageProps {
  locale: Locale;
  searchParams: SearchParams;
  basePath: string;
  title: string;
  type?: string;
}

export async function AccommodationPage({
  locale,
  searchParams: sp,
  basePath,
  title,
  type,
}: AccommodationPageProps) {
  const cityId = one(sp.city_id);
  const search = one(sp.search);
  const starsRaw = int(one(sp.stars));
  const stars =
    starsRaw !== undefined && starsRaw >= 1 && starsRaw <= 5
      ? starsRaw
      : undefined;
  const minRaw = int(one(sp.min_price));
  const minPrice = minRaw !== undefined && minRaw >= 0 ? minRaw : undefined;
  const maxRaw = int(one(sp.max_price));
  const maxPrice = maxRaw !== undefined && maxRaw >= 0 ? maxRaw : undefined;
  const sortRaw = one(sp.sort);
  const sort = SORTS.includes(sortRaw as Sort) ? (sortRaw as Sort) : undefined;
  const page = Math.max(1, int(one(sp.page)) ?? 1);
  const checkIn = one(sp.check_in);
  const checkOut = one(sp.check_out);
  const guests = int(one(sp.guests));
  const paymentTypeRaw = one(sp.payment_type);
  const paymentType = paymentTypeRaw === "online_payment" || paymentTypeRaw === "pay_at_property" ? paymentTypeRaw : undefined;

  const [common, dict, cities, hotelsResult] = await Promise.all([
    getDictionary(locale, "common"),
    getDictionary(locale, "hotels"),
    api.catalog.getCities(locale),
    api.hotels.getHotels(locale, {
      cityId,
      search,
      stars,
      type,
      minPrice,
      maxPrice,
      sort,
      page,
      limit: PAGE_SIZE,
      paymentType,
    }),
  ]);

  const all: HotelListItem[] = hotelsResult.items;
  const total = hotelsResult.total;
  const totalPages = Math.max(1, hotelsResult.totalPages);
  const safePage = Math.min(page, totalPages);
  const items = all;

  const currentParams: Record<string, string> = {};
  if (cityId) currentParams.city_id = cityId;
  if (search) currentParams.search = search;
  if (stars !== undefined) currentParams.stars = String(stars);
  if (minPrice !== undefined) currentParams.min_price = String(minPrice);
  if (maxPrice !== undefined) currentParams.max_price = String(maxPrice);
  if (sort) currentParams.sort = sort;
  if (checkIn) currentParams.check_in = checkIn;
  if (checkOut) currentParams.check_out = checkOut;
  if (guests) currentParams.guests = String(guests);
  if (paymentType) currentParams.payment_type = paymentType;

  const clearedParams: Record<string, string> = {};
  if (cityId) clearedParams.city_id = cityId;
  if (search) clearedParams.search = search;
  if (checkIn) clearedParams.check_in = checkIn;
  if (checkOut) clearedParams.check_out = checkOut;
  if (guests) clearedParams.guests = String(guests);
  const clearedQuery = new URLSearchParams(clearedParams).toString();
  const clearedHref = `${basePath}${clearedQuery ? `?${clearedQuery}` : ""}`;

  return (
    <main className="relative mx-auto flex w-full md:w-[96%] max-w-[1536px] flex-1 flex-col px-3 sm:px-4 md:px-8 pb-8 pt-3 sm:pt-6">
      
      {/* ═══ Header Banner ═══ */}
      <div className="relative mb-4 sm:mb-6 flex h-[200px] sm:h-[260px] md:h-[300px] w-full flex-col justify-center overflow-hidden rounded-[20px] sm:rounded-xl px-5 sm:px-8 md:px-12">
        {/* Background photo */}
        <Image
          src="/hotels_hero.jpg"
          alt="Hotels hero"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
          quality={85}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/45" />
        {/* Bottom gradient blending into page */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-100/80 to-transparent dark:from-slate-950/80" />

        <div className="relative z-10 w-full sm:max-w-[70%] lg:max-w-[55%]">
          <h1 className="mb-1.5 sm:mb-2.5 text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
            {dict.bannerTitle || "Mehmonxona, Dacha, Sanatoriya va Oromgohlar qidirish xizmati"}
          </h1>
          <p className="hidden sm:block text-[13px] sm:text-[14px] font-medium leading-relaxed text-white/80 drop-shadow">
            {dict.bannerSubtitle || "O'zbekiston bo'ylab o'zingizga mos va qulay turar joylarni arzon narxlarda kashf eting."}
          </p>
        </div>
        
      </div>

      <div className="relative z-20 mb-4 sm:mb-6 w-full lg:w-4/5 mx-auto">
        <SearchBar
          locale={locale}
          dict={common.search}
          cities={cities}
          defaults={{ cityId, checkIn, checkOut, guests }}
        />
      </div>
      
      <div className="mb-4 sm:mb-6">
        <AccommodationCategoryTabs locale={locale} dict={common.nav as Record<string, string>} />
      </div>

      <div className="flex flex-col gap-3">
        {total === 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-800">
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  {title}
                </h1>
                <span aria-live="polite" className="text-xs font-bold text-slate-400 sm:text-sm">
                  {dict.resultsCount.replace("{count}", String(total))}
                </span>
              </div>
            </div>
            <Suspense fallback={null}>
              <ActiveFilters dict={dict} />
            </Suspense>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <Suspense fallback={null}>
            <HotelFilters dict={{ filters: dict.filters, types: dict.types, starOptions: dict.starOptions, amenityOptions: dict.amenityOptions, paymentOptions: dict.paymentOptions }} sortSelect={null} />
          </Suspense>
          <section aria-label={dict.title}>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="font-medium text-slate-700 dark:text-slate-200">{dict.empty}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{dict.emptyHint}</p>
              <Link href={clearedHref}>
                <Button variant="secondary">{dict.clearFilters}</Button>
              </Link>
            </div>
          </section>
        </div>
      ) : (
        <AccommodationListWithMap
          items={items}
          locale={locale}
          dict={dict}
          basePath={basePath}
          safePage={safePage}
          totalPages={totalPages}
          currentParams={currentParams}
          filters={
            <Suspense key="filters" fallback={null}>
              <HotelFilters
                dict={{ filters: dict.filters, types: dict.types, starOptions: dict.starOptions, amenityOptions: dict.amenityOptions, paymentOptions: dict.paymentOptions }}
                sortSelect={
                  <Suspense key="mobileSortSelect" fallback={null}>
                    <HotelSortSelect dict={dict.sort} />
                  </Suspense>
                }
              />
            </Suspense>
          }
          headerTitle={
            <div key="headerTitle" className="flex items-baseline gap-3">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {title}
              </h1>
              <span aria-live="polite" className="text-xs font-bold text-slate-400 sm:text-sm">
                {dict.resultsCount.replace("{count}", String(total))}
              </span>
            </div>
          }
          headerSort={
            <Suspense key="headerSort" fallback={null}>
              <HotelSortSelect dict={dict.sort} />
            </Suspense>
          }
          activeFilters={
            <Suspense key="activeFilters" fallback={null}>
              <ActiveFilters dict={dict} />
            </Suspense>
          }
        />
      )}
    </main>
  );
}
