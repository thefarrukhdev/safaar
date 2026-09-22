import { ArrowRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { HomeDict } from "@/i18n/dictionaries";
import { UniversalCard } from "@/components/ui/UniversalCard";
import { DealsMobileCarousel } from "./DealsMobileCarousel";
import { SectionHeader } from "@/components/ui/SectionHeader";

export interface DealItem {
  id: string;
  slug: string;
  name: string;
  cityName: string;
  imageUrl: string;
  oldPriceSum: number;
  newPriceSum: number;
  discountPercent: number;
  endsAt: string;
}

function DealCard({
  deal,
  dict,
  locale,
  now,
}: {
  deal: DealItem;
  dict: HomeDict["deals"];
  locale: Locale;
  now: number;
}) {
  const endsInDays = deal.endsAt && now > 0
    ? Math.max(0, Math.ceil((Date.parse(deal.endsAt) - now) / 86_400_000))
    : 0;

  const discountBadge = (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-amber-500 px-2.5 text-xs font-semibold text-slate-900">
      -{deal.discountPercent}%
    </span>
  );

  const tags = endsInDays > 0 ? [`⏳ ${endsInDays} ${dict.days}`] : undefined;
  const viewDetailsLabel = locale === "ru" ? "Подробнее" : locale === "en" ? "Details" : "Batafsil";

  return (
    <UniversalCard
      imageSrc={deal.imageUrl}
      imageAlt={deal.name}
      topLeft={discountBadge}
      showFavorite
      title={deal.name}
      location={deal.cityName}
      tags={tags}
      href={`/${locale}/${deal.slug.includes("/") ? deal.slug : "hotels/" + deal.slug}`}
      locale={locale}
      price={{
        amount: deal.newPriceSum,
        oldAmount: deal.oldPriceSum,
        period: `1 ${dict.perNight}`,
      }}
      actionLabel={viewDetailsLabel}
    />
  );
}

import { EmptyState } from "@/components/ui/EmptyState";
import { Tag } from "lucide-react";

export function DealsSection({
  deals,
  dict,
  locale,
}: {
  deals: DealItem[];
  dict: HomeDict["deals"];
  locale: Locale;
}) {
  // RSC rendering evaluates `now` on the server during request time
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <section className="mx-auto w-full md:w-[96%] max-w-[1536px] px-3 sm:px-4 md:px-8">
      <SectionHeader 
        title={dict.title}
        subtitle={dict.subtitle}
      />

      {deals.length === 0 ? (
          <EmptyState 
            icon={<Tag className="h-10 w-10 text-slate-400" />}
          title={(dict as any).empty || "Hozircha bo'sh"} 
          description={(dict as any).emptyDesc || "Ushbu sahifada tez orada foydali chegirmalar paydo bo'ladi."} 
          className="mt-6"
        />
      ) : (
        <>
          {/* Mobile Carousel (Client wrapper for interaction, Server Children) */}
          <DealsMobileCarousel itemsCount={deals.length}>
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="w-[85vw] max-w-[320px] sm:w-[calc(50%-0.375rem)] shrink-0 snap-start"
              >
                <DealCard deal={deal} locale={locale} dict={dict} now={now} />
              </div>
            ))}
          </DealsMobileCarousel>

          {/* Desktop Grid */}
          <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4 mt-6">
            {deals.slice(0, 4).map((deal) => (
              <DealCard key={deal.id} deal={deal} locale={locale} dict={dict} now={now} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
