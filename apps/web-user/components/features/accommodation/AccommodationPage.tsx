import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/api";
import { SearchBar } from "@/components/search/SearchBar";
import { HotelFilters } from "@/components/hotels/HotelFilters";
import { HotelSortSelect } from "@/components/hotels/HotelSortSelect";
import { ActiveFilters } from "@/components/hotels/ActiveFilters";
import { HotelsPagination } from "@/components/hotels/HotelsPagination";
import { AccommodationCard } from "@/components/accommodation/AccommodationCard";
import { Button } from "@/components/ui/Button";
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
}

export async function AccommodationPage({
  locale,
  searchParams: sp,
  basePath,
  title,
}: AccommodationPageProps) {
  const cityId = one(sp.city_id);
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

  const [common, dict, cities, hotelsResult] = await Promise.all([
    getDictionary(locale, "common"),
    getDictionary(locale, "hotels"),
    api.catalog.getCities(locale),
    api.hotels.getHotels(locale, {
      cityId,
      stars,
      minPrice,
      maxPrice,
      sort,
      page,
      limit: PAGE_SIZE,
    }),
  ]);

  const all: HotelListItem[] = hotelsResult.items;
  const total = hotelsResult.total;
  const totalPages = Math.max(1, hotelsResult.totalPages);
  const safePage = Math.min(page, totalPages);
  const items = all;

  const currentParams: Record<string, string> = {};
  if (cityId) currentParams.city_id = cityId;
  if (stars !== undefined) currentParams.stars = String(stars);
  if (minPrice !== undefined) currentParams.min_price = String(minPrice);
  if (maxPrice !== undefined) currentParams.max_price = String(maxPrice);
  if (sort) currentParams.sort = sort;
  if (checkIn) currentParams.check_in = checkIn;
  if (checkOut) currentParams.check_out = checkOut;
  if (guests) currentParams.guests = String(guests);

  const clearedParams: Record<string, string> = {};
  if (cityId) clearedParams.city_id = cityId;
  if (checkIn) clearedParams.check_in = checkIn;
  if (checkOut) clearedParams.check_out = checkOut;
  if (guests) clearedParams.guests = String(guests);
  const clearedQuery = new URLSearchParams(clearedParams).toString();
  const clearedHref = `${basePath}${clearedQuery ? `?${clearedQuery}` : ""}`;

  return (
    <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
      <SearchBar
        locale={locale}
        dict={common.search}
        cities={cities}
        defaults={{ cityId, checkIn, checkOut, guests }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl dark:text-white">{title}</h1>
            <p aria-live="polite" className="text-xs text-slate-500 sm:text-sm dark:text-slate-400">
              {dict.resultsCount.replace("{count}", String(total))}
            </p>
          </div>
          {total > 0 && (
            <Suspense fallback={null}>
              <HotelSortSelect dict={dict.sort} />
            </Suspense>
          )}
        </div>
        <Suspense fallback={null}>
          <ActiveFilters dict={dict} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <Suspense fallback={null}>
          <HotelFilters dict={{ filters: dict.filters, types: dict.types, starOptions: dict.starOptions, amenityOptions: dict.amenityOptions, paymentOptions: dict.paymentOptions }} />
        </Suspense>

        <section aria-label={dict.title}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="font-medium text-slate-700 dark:text-slate-200">{dict.empty}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{dict.emptyHint}</p>
              <Link href={clearedHref}>
                <Button variant="secondary">{dict.clearFilters}</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                {items.map((hotel) => (
                  <AccommodationCard
                    key={hotel.id}
                    hotel={hotel}
                    locale={locale}
                    labels={{ perNight: dict.perNight, reviews: dict.reviews }}
                  />
                ))}
              </div>
              <HotelsPagination
                basePath={basePath}
                params={currentParams}
                page={safePage}
                totalPages={totalPages}
                dict={dict.pagination}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
