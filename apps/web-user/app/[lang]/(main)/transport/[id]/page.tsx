import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { api, ApiRequestError } from "@/lib/api";
import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { MapPin, Phone, Star, Users, Fuel, Luggage, Car } from "lucide-react";
import Image from "next/image";
import { TransportBookingSection } from "@/components/features/transport/TransportBookingSection";
import { HotelGallery } from "@/components/hotels/HotelGallery";
import { FavoriteButton } from "@/components/favorites/FavoriteButton";
import { ReviewsList } from "@/components/features/reviews/ReviewsList";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const getTransport = cache(async (id: string, locale: Locale) => {
  return await api.catalog.getTransport(id, locale);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  try {
    const transport = await getTransport(id, locale);
    return {
      title: `${transport.name} — Safaar`,
      description: `${transport.name}, ${transport.cityName}`,
    };
  } catch {
    return {};
  }
}

export default async function TransportDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : "uz";

  const [dict, favDict, session, reviewsDict, reviews] = await Promise.all([
    getDictionary(locale, "transport"),
    getDictionary(locale, "favorites"),
    getSession(),
    getDictionary(locale, "reviews"),
    api.reviews.getBusCompanyReviews(id).catch(() => []),
  ]);
  let transport;
  try {
    transport = await getTransport(id, locale);
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.statusCode === 404) {
      notFound();
    }
    notFound();
  }

  if (!transport) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full md:w-[96%] max-w-[1536px] flex-1 flex-col gap-6 px-3 sm:px-4 md:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      <div className="overflow-hidden rounded-2xl">
        <HotelGallery
          images={transport.images.length > 0 ? transport.images : (transport.imageUrl ? [transport.imageUrl] : [])}
          alt={transport.name}
        />
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {transport.name}
              </h1>
              <FavoriteButton
                targetType="transport"
                targetId={transport.id}
                initialFavoriteId={(transport as any).favoriteId ?? null}
                authed={!!session}
                loginHref={`/${locale}/login?next=/${locale}/transport/${transport.id}`}
                dict={favDict}
              />
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              {transport.cityName}
              {transport.companyName ? ` · ${transport.companyName}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {transport.rating > 0 && (
              <Badge
                variant="outline"
                className="gap-1 px-3 py-1 text-sm text-amber-700 dark:text-amber-400"
              >
                <Star className="h-4 w-4 fill-current text-amber-500" />
                {transport.rating.toFixed(1)}
                {transport.reviewsCount > 0 ? ` (${transport.reviewsCount})` : ""}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
            <Users className="h-4 w-4 text-slate-400" />
            {transport.seats} {(dict as any).detail?.seats || "o'rin"}
          </span>
          {transport.fuelType && (
            <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
              <Fuel className="h-4 w-4 text-slate-400" />
              {transport.fuelType}
            </span>
          )}
          {transport.luggageCapacityBags != null && (
            <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
              <Luggage className="h-4 w-4 text-slate-400" />
              {transport.luggageCapacityBags} {(dict as any).detail?.bags || "sumka"}
            </span>
          )}
          {transport.phone && (
            <a
              href={`tel:${transport.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <Phone className="h-4 w-4 text-slate-400" />
              {transport.phone}
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{(dict as any).detail?.about || "Transport haqida"}</h2>
            <p className="whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-300">
              {((dict as any).detail?.rentalDescription || "{company} tomonidan taqdim etiladigan {name}. Kunlik ijaraga olish uchun quyidagi sanalarni tanlang.").replace("{company}", transport.companyName || "Hamkor").replace("{name}", transport.name)}
            </p>
          </section>

          <section id="reviews" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {reviewsDict.title || "Sharhlar"}
            </h2>
            <ReviewsList 
              reviews={reviews} 
              dict={reviewsDict} 
              locale={locale} 
              targetId={id}
              targetType="bus_company"
              authed={!!session}
              token={session?.accessToken}
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24">
          <TransportBookingSection transport={transport} dict={dict} isLoggedIn={!!session} />
        </aside>
      </div>
    </main>
  );
}
