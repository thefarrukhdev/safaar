import Link from "next/link";
import { AccommodationCard } from "@/components/features/accommodation/AccommodationCard";
import { FeaturedHotelsMobileCarousel } from "./FeaturedHotelsMobileCarousel";
import type { HotelListItem } from "@/types/view";
import type { Locale } from "@/i18n/config";
import type { HomeDict } from "@/i18n/dictionaries";

import { SectionHeader } from "@/components/ui/SectionHeader";

import { EmptyState } from "@/components/ui/EmptyState";
import { BedDouble } from "lucide-react";

export function FeaturedHotelsCarousel({
  hotels,
  dict,
  locale,
}: {
  hotels: HotelListItem[];
  dict: HomeDict["featured"];
  locale: Locale;
}) {
  const cards = hotels;

  return (
    <section aria-label={dict.title} className="mx-auto mt-6 w-full md:w-[96%] max-w-[1536px] px-3 sm:px-4 md:px-8 relative sm:mt-8">
      <SectionHeader
        title={dict.title}
        action={
          <Link
            href={`/${locale}/hotels`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-slate-900/[0.05] px-4 text-xs font-medium text-slate-900  transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:h-10 sm:text-sm sm:px-5 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {dict.all}
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
              <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        }
      />
      
      {cards.length === 0 ? (
        <div className="mt-6">
          <EmptyState 
            icon={<BedDouble className="h-10 w-10 text-slate-400 dark:text-slate-500" />}
            title={(dict as any).empty || "Hozircha bo'sh"} 
            description={(dict as any).emptyDesc || "Ayni paytda tavsiya etilgan joylar mavjud emas. Tez orada yangilanadi."} 
          />
        </div>
      ) : (
        <>
          {/* Mobile: horizontal scroll with client wrapper for buttons and scroll logic */}
          <FeaturedHotelsMobileCarousel itemsCount={cards.length}>
            {cards.map((hotel) => (
              <div
                key={hotel.id}
                className="w-[85vw] max-w-[320px] sm:w-[calc(50%-0.375rem)] shrink-0 snap-start"
              >
                <AccommodationCard hotel={hotel} locale={locale} />
              </div>
            ))}
          </FeaturedHotelsMobileCarousel>

          {/* Desktop: 4 cards grid */}
          <div className="hidden gap-4 md:grid md:grid-cols-4 mt-6">
            {cards.map((hotel) => (
              <AccommodationCard key={hotel.id} hotel={hotel} locale={locale} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
