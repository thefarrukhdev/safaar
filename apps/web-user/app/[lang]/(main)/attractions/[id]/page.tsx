import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { api, ApiRequestError } from "@/lib/api";
import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { MapPin, Clock, Star, Compass } from "lucide-react";
import Image from "next/image";
import { getDictionary } from "@/i18n/dictionaries";
import { DetailLocationSection } from "@/components/features/shared/DetailLocationSection";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  try {
    const attractions = await api.catalog.getAttractions(locale);
    const attraction = attractions.find((a) => a.id === id);
    if (!attraction) return {};
    return {
      title: `${attraction.name} — Safaar`,
      description: attraction.description?.slice(0, 160),
    };
  } catch {
    return {};
  }
}

export default async function AttractionDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : "uz";

  const [dict, attractions] = await Promise.all([
    getDictionary(locale, "attractions"),
    api.catalog.getAttractions(locale).catch(() => []),
  ]);
  
  const attraction = attractions.find((a) => a.id === id);

  if (!attraction) {
    notFound();
  }

  const categoryLabel = (dict as any).categories?.[attraction.categoryKey] ?? attraction.categoryDefault;

  return (
    <main className="mx-auto flex w-full md:w-[96%] max-w-[1536px] flex-1 flex-col gap-6 px-3 sm:px-4 md:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      {/* Main Cover */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="relative aspect-[21/9] w-full bg-slate-100">
          {attraction.imageUrl ? (
            <Image
              src={attraction.imageUrl}
              alt={attraction.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Compass className="h-16 w-16" />
            </div>
          )}
        </div>
      </div>

      {/* Header Info */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                {categoryLabel}
              </Badge>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {attraction.name}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              {attraction.cityName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {attraction.rating > 0 && (
              <Badge
                variant="outline"
                className="gap-1 px-3 py-1 text-sm text-slate-700 border-slate-200"
              >
                <Star className="h-4 w-4 fill-current text-blue-600" />
                {attraction.rating.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600">
          {attraction.bestTimeToVisit && (
            <span className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 border border-slate-200">
              <Clock className="h-4 w-4 text-slate-400" />
              Eng yaxshi vaqt: {attraction.bestTimeToVisit}
            </span>
          )}
        </div>
      </header>

      {/* Body Content */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          {attraction.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                Obida haqida
              </h2>
              <p className="whitespace-pre-line leading-relaxed text-slate-600">
                {attraction.description}
              </p>
            </section>
          )}

          <section id="location" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <DetailLocationSection 
              title="Joylashuv"
              address={attraction.cityName} 
              latitude={attraction.latitude} 
              longitude={attraction.longitude} 
              itemName={attraction.name}
              itemImage={attraction.imageUrl ?? undefined}
              itemRating={attraction.rating}
              openInMapsText="Google Maps'da ochish"
              noCoordsText="Xarita koordinatalari mavjud emas"
            />
          </section>
        </div>
      </div>
    </main>
  );
}
