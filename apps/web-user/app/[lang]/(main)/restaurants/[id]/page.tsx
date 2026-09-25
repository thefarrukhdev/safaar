import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { api, ApiRequestError } from "@/lib/api";
import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { MapPin, Phone, Star, Clock, Utensils } from "lucide-react";
import Image from "next/image";
import { RestaurantBookingSection } from "@/components/features/restaurants/RestaurantBookingSection";
import { ReviewsList } from "@/components/features/reviews/ReviewsList";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const getRestaurant = cache(async (id: string, locale: Locale) => {
  return await api.catalog.getRestaurant(id, locale);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  try {
    const restaurant = await getRestaurant(id, locale);
    return {
      title: `${restaurant.name} — Safaar`,
      description: restaurant.description?.slice(0, 160),
    };
  } catch {
    return {};
  }
}

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const locale = isLocale(lang) ? lang : "uz";

  const [dict, session, reviewsDict, reviews] = await Promise.all([
    getDictionary(locale, "restaurants"),
    getSession(),
    getDictionary(locale, "reviews"),
    api.reviews.getRestaurantReviews(id).catch(() => []),
  ]);
  let restaurant;
  try {
    restaurant = await getRestaurant(id, locale);
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.statusCode === 404) {
      notFound();
    }
    notFound();
  }

  if (!restaurant) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full md:w-[96%] max-w-[1536px] flex-1 flex-col gap-6 px-3 sm:px-4 md:px-8 py-4 sm:py-6">
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      {/* Main Cover and Gallery */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative aspect-[21/9] w-full bg-slate-100 dark:bg-slate-800">
          {restaurant.imageUrl ? (
            <Image
              src={restaurant.imageUrl}
              alt={restaurant.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Utensils className="h-16 w-16" />
            </div>
          )}
        </div>

        {restaurant.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {restaurant.images.map((img, idx) => (
              <div
                key={idx}
                className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <Image
                  src={img}
                  alt={`${restaurant.name} ${idx + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Header Info */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {restaurant.name}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              {restaurant.cityName}
              {restaurant.address ? ` · ${restaurant.address}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {restaurant.rating > 0 && (
              <Badge
                variant="outline"
                className="gap-1 px-3 py-1 text-sm text-amber-700 dark:text-amber-400"
              >
                <Star className="h-4 w-4 fill-current text-amber-500" />
                {restaurant.rating.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
          {restaurant.workingHours && (
            <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-800">
              <Clock className="h-4 w-4 text-slate-400" />
              {(dict as any).detail?.workingHours || "Ish vaqti"}: {restaurant.workingHours}
            </span>
          )}
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone.replace(/\s+/g, "")}`}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              <Phone className="h-4 w-4 text-slate-400" />
              {restaurant.phone}
            </a>
          )}
        </div>
      </header>

      {/* Body Content and Booking Form */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-8">
          {restaurant.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {(dict as any).detail?.about || "Restoran haqida"}
              </h2>
              <p className="whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-300">
                {restaurant.description}
              </p>
            </section>
          )}

          <section id="reviews" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {reviewsDict.title || "Sharhlar"}
            </h2>
            <ReviewsList 
              reviews={reviews} 
              dict={reviewsDict} 
              locale={locale} 
              targetId={id}
              targetType="restaurant"
              authed={!!session}
              token={session?.accessToken}
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24">
          <RestaurantBookingSection restaurant={restaurant} dict={dict} />
        </aside>
      </div>
    </main>
  );
}
