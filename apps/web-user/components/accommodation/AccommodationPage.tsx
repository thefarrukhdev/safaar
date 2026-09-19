import Link from "next/link";
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
      <div className="relative mb-4 sm:mb-6 flex h-[160px] sm:h-[200px] w-full flex-col justify-center overflow-hidden rounded-[20px] sm:rounded-[24px] bg-gradient-to-r from-[#f0f7ff] to-[#e6f2ff] px-5 sm:px-8 md:px-12 dark:from-slate-900 dark:to-slate-800">
        <div className="relative z-10 w-full sm:max-w-[65%] lg:max-w-[52%]">
          <h1 className="mb-1.5 sm:mb-2.5 text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-[#0f172a] dark:text-white leading-tight">
            Mehmonxona, Dacha, Sanatoriya va Oromgohlar qidirish xizmati
          </h1>
          <p className="hidden sm:block text-[13px] sm:text-[14px] font-medium leading-relaxed text-[#475569] dark:text-slate-400">
            O'zbekiston bo'ylab o'zingizga mos va qulay turar joylarni arzon narxlarda kashf eting.
          </p>
        </div>
        
        {/* Decorative Inline SVG Skyline — Refined Islamic Architecture */}
        <div className="absolute right-0 top-0 z-0 h-full w-[45%] sm:w-[62%] flex items-end pointer-events-none overflow-hidden">
          <svg viewBox="0 0 800 210" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="xMaxYMax meet">
            <defs>
              <linearGradient id="skyBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0.7"/>
              </linearGradient>
            </defs>
            <g fill="url(#skyBlue)">

              {/* === FAR LEFT: Small minaret + arch === */}
              <rect x="10" y="155" width="22" height="55" rx="2"/>
              <path d="M10,155 Q21,143 32,155Z"/>
              <rect x="18" y="110" width="8" height="48" rx="1"/>
              <path d="M18,110 Q22,102 26,110Z"/>
              <ellipse cx="22" cy="106" rx="5" ry="3"/>

              {/* === LEFT CLUSTER: Mosque with dome === */}
              <rect x="42" y="148" width="55" height="62" rx="2"/>
              {/* arch windows */}
              <path d="M50,148 Q58,136 66,148Z"/>
              <path d="M68,148 Q76,136 84,148Z"/>
              {/* dome */}
              <path d="M42,148 Q69,108 96,148Z"/>
              <rect x="62" y="95" width="14" height="56" rx="1"/>
              <path d="M62,95 Q69,85 76,95Z"/>
              <ellipse cx="69" cy="82" rx="8" ry="12" opacity="0.85"/>
              <path d="M67,70 L69,64 L71,70Z"/>

              {/* Left tall minaret */}
              <rect x="104" y="88" width="11" height="122" rx="2"/>
              <ellipse cx="109" cy="86" rx="7" ry="4.5"/>
              <path d="M104,86 Q109,75 114,86Z"/>
              <path d="M107,70 L109,62 L111,70Z"/>
              <rect x="106" y="100" width="7" height="2.5" rx="1" opacity="0.55"/>
              <rect x="106" y="111" width="7" height="2.5" rx="1" opacity="0.55"/>
              <rect x="106" y="122" width="7" height="2.5" rx="1" opacity="0.55"/>
              <rect x="106" y="133" width="7" height="2.5" rx="1" opacity="0.55"/>
              <rect x="106" y="144" width="7" height="2.5" rx="1" opacity="0.55"/>

              {/* === CENTRE MAIN MOSQUE (largest, most detailed) === */}
              {/* Platform */}
              <rect x="124" y="162" width="148" height="48" rx="3"/>
              {/* Side wings */}
              <rect x="124" y="150" width="35" height="22" rx="2"/>
              <rect x="237" y="150" width="35" height="22" rx="2"/>
              {/* Arch decorations on platform */}
              <path d="M134,162 Q141,153 148,162Z"/>
              <path d="M153,162 Q160,153 167,162Z"/>
              <path d="M172,162 Q179,153 186,162Z"/>
              <path d="M222,162 Q229,153 236,162Z"/>
              <path d="M237,162 Q244,153 251,162Z"/>
              {/* Main large dome */}
              <path d="M138,148 Q198,75 258,148Z"/>
              <ellipse cx="198" cy="120" rx="12" ry="18" opacity="0.7"/>
              {/* Dome finial */}
              <rect x="195" y="72" width="6" height="20" rx="1"/>
              <path d="M193,72 L198,62 L203,72Z"/>
              <ellipse cx="198" cy="70" rx="4" ry="3"/>
              {/* Left main minaret */}
              <rect x="130" y="72" width="14" height="96" rx="2"/>
              <ellipse cx="137" cy="70" rx="9" ry="5.5"/>
              <path d="M130,70 Q137,57 144,70Z"/>
              <path d="M134,55 L137,46 L140,55Z"/>
              <rect x="132" y="82" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="132" y="93" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="132" y="104" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="132" y="115" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="132" y="126" width="10" height="3" rx="1" opacity="0.5"/>
              {/* Right main minaret */}
              <rect x="252" y="72" width="14" height="96" rx="2"/>
              <ellipse cx="259" cy="70" rx="9" ry="5.5"/>
              <path d="M252,70 Q259,57 266,70Z"/>
              <path d="M256,55 L259,46 L262,55Z"/>
              <rect x="254" y="82" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="254" y="93" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="254" y="104" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="254" y="115" width="10" height="3" rx="1" opacity="0.5"/>
              <rect x="254" y="126" width="10" height="3" rx="1" opacity="0.5"/>

              {/* === RIGHT: Medium mosque === */}
              <rect x="282" y="154" width="70" height="56" rx="2"/>
              <path d="M282,154 Q317,115 352,154Z"/>
              <rect x="309" y="102" width="9" height="54" rx="1"/>
              <path d="M309,102 Q313.5,93 318,102Z"/>
              <path d="M311,90 L313.5,83 L316,90Z"/>
              <ellipse cx="313" cy="88" rx="5.5" ry="3.5"/>
              {/* Medium minaret right */}
              <rect x="358" y="105" width="11" height="105" rx="2"/>
              <ellipse cx="363" cy="103" rx="7" ry="4"/>
              <path d="M358,103 Q363,93 368,103Z"/>
              <path d="M361,91 L363,84 L365,91Z"/>
              <rect x="360" y="114" width="7" height="2.5" rx="1" opacity="0.5"/>
              <rect x="360" y="124" width="7" height="2.5" rx="1" opacity="0.5"/>
              <rect x="360" y="134" width="7" height="2.5" rx="1" opacity="0.5"/>
              <rect x="360" y="144" width="7" height="2.5" rx="1" opacity="0.5"/>

              {/* === FAR RIGHT: buildings tapering off with domes === */}

              {/* Building 1: small mosque with dome */}
              <rect x="378" y="148" width="52" height="62" rx="2"/>
              <path d="M378,148 Q404,120 430,148Z"/>
              <rect x="398" y="112" width="8" height="38" rx="1"/>
              <path d="M396,112 Q402,103 408,112Z"/>
              <path d="M400,101 L402,95 L404,101Z"/>
              {/* arch windows */}
              <path d="M384,148 Q390,140 396,148Z"/>
              <path d="M408,148 Q414,140 420,148Z"/>

              {/* Building 2: minaret + arched building */}
              <rect x="436" y="128" width="10" height="82" rx="2"/>
              <ellipse cx="441" cy="126" rx="6" ry="4"/>
              <path d="M436,126 Q441,117 446,126Z"/>
              <path d="M439,115 L441,109 L443,115Z"/>

              {/* Building 3: mosque with small dome */}
              <rect x="452" y="145" width="45" height="65" rx="2"/>
              <path d="M452,145 Q474,126 496,145Z"/>
              <rect x="470" y="118" width="8" height="28" rx="1"/>
              <path d="M468,118 Q474,109 480,118Z"/>
              <path d="M472,107 L474,101 L476,107Z"/>
              <ellipse cx="474" cy="100" rx="4" ry="3"/>
              <path d="M459,145 Q465,137 471,145Z"/>
              <path d="M476,145 Q482,137 488,145Z"/>

              {/* Building 4: medium mosque */}
              <rect x="502" y="155" width="40" height="55" rx="2"/>
              <path d="M502,155 Q522,136 542,155Z"/>
              <rect x="518" y="130" width="7" height="27" rx="1"/>
              <path d="M516,130 Q521.5,122 527,130Z"/>
              <path d="M519,120 L521.5,114 L524,120Z"/>
              <path d="M508,155 Q514,147 520,155Z"/>
              <path d="M524,155 Q530,147 536,155Z"/>

              {/* Building 5: mosque with dome + small minaret */}
              <rect x="547" y="158" width="55" height="52" rx="2"/>
              <path d="M547,158 Q574,132 601,158Z"/>
              <rect x="569" y="130" width="9" height="28" rx="1"/>
              <path d="M567,130 Q573.5,121 580,130Z"/>
              <path d="M571,119 L573.5,113 L576,119Z"/>
              <ellipse cx="574" cy="112" rx="4.5" ry="3"/>
              <path d="M553,158 Q560,149 567,158Z"/>
              <path d="M574,158 Q581,149 588,158Z"/>

              {/* Building 6: small arched building */}
              <rect x="607" y="162" width="50" height="48" rx="2"/>
              <path d="M607,162 Q632,145 657,162Z"/>
              <rect x="628" y="140" width="7" height="23" rx="1"/>
              <path d="M626,140 Q631.5,132 637,140Z"/>
              <path d="M629,131 L631.5,125 L634,131Z"/>
              <path d="M614,162 Q621,154 628,162Z"/>
              <path d="M634,162 Q641,154 648,162Z"/>

              {/* Building 7: tapering small minaret */}
              <rect x="662" y="165" width="48" height="45" rx="2"/>
              <path d="M662,165 Q686,149 710,165Z"/>
              <rect x="683" y="146" width="6" height="20" rx="1"/>
              <path d="M681,146 Q686,138 691,146Z"/>
              <path d="M684,137 L686,131 L688,137Z"/>
              <path d="M668,165 Q675,157 682,165Z"/>
              <path d="M689,165 Q696,157 703,165Z"/>

              {/* Building 8: far right small end */}
              <rect x="714" y="168" width="40" height="42" rx="2"/>
              <path d="M714,168 Q734,153 754,168Z"/>
              <rect x="731" y="150" width="6" height="19" rx="1"/>
              <path d="M729,150 Q734,142 739,150Z"/>
              <path d="M732,142 L734,136 L736,142Z"/>

              <rect x="756" y="170" width="44" height="40" rx="2"/>
              <path d="M756,170 Q778,156 800,170Z"/>

              {/* Ground fill */}
              <rect x="0" y="208" width="800" height="5" rx="0" opacity="0.35"/>
            </g>

          </svg>
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
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
