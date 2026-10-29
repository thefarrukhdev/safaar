/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { api, ApiRequestError } from "@/lib/api";
import { BackButton } from "@/components/ui/BackButton";
import { Badge } from "@/components/ui/Badge";
import { MapPin, Phone, Star, Clock, Utensils, Banknote, ExternalLink } from "lucide-react";
import Image from "next/image";
import { RestaurantBookingSection } from "@/components/features/restaurants/RestaurantBookingSection";
import { RestaurantGallery } from "@/components/features/restaurants/RestaurantGallery";
import { RestaurantAmenitiesSection } from "@/components/features/restaurants/RestaurantAmenitiesSection";
import { RestaurantRulesSection } from "@/components/features/restaurants/RestaurantRulesSection";
import { DetailLocationSection } from "@/components/features/shared/DetailLocationSection";
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
      description: restaurant.metaDescription || restaurant.description?.slice(0, 160),
      keywords: restaurant.metaKeywords,
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

  const schema = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: restaurant.name,
    description: restaurant.metaDescription || restaurant.description,
    image: restaurant.imageUrl || undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: restaurant.cityName,
      streetAddress: restaurant.address,
    },
    ...((restaurant.contactPhone || restaurant.phone) && {
      telephone: restaurant.contactPhone || restaurant.phone,
    }),
    ...((restaurant.openingHours || restaurant.workingHours) && {
      openingHours: restaurant.openingHours || restaurant.workingHours,
    }),
    ...(restaurant.priceRange && { priceRange: restaurant.priceRange }),
    ...(restaurant.cuisine && restaurant.cuisine.length > 0 && {
      servesCuisine: restaurant.cuisine,
    }),
    ...(restaurant.menuUrl && { hasMenu: restaurant.menuUrl }),
    ...(restaurant.rating > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: restaurant.rating,
        reviewCount: reviews.length > 0 ? reviews.length : 1,
      },
    }),
  };

  return (
    <main className="mx-auto flex w-full md:w-[96%] max-w-[1536px] flex-1 flex-col gap-6 px-3 sm:px-4 md:px-8 py-4 sm:py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="flex items-center justify-between">
        <BackButton />
      </div>

      {/* Main Cover and Gallery */}
      <RestaurantGallery
        images={restaurant.images && restaurant.images.length > 0 ? restaurant.images : [restaurant.imageUrl].filter(Boolean)}
        alt={restaurant.name}
      />

      {/* Header Info */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {restaurant.name}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              {restaurant.cityName}
              {restaurant.address ? ` · ${restaurant.address}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {restaurant.rating > 0 && (
              <Badge
                variant="outline"
                className="gap-1 px-3 py-1 text-sm text-amber-700"
              >
                <Star className="h-4 w-4 fill-current text-amber-500" />
                {restaurant.rating.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>

        {restaurant.cuisine && restaurant.cuisine.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {restaurant.cuisine.map((c, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-medium px-2.5 py-0.5 text-xs"
              >
                {c}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 pt-1">
          {(restaurant.openingHours || restaurant.workingHours) && (
            <span className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200/80 px-2.5 py-1.5 shadow-xs">
              <Clock className="h-4 w-4 text-slate-400" />
              {(dict as any).detail?.workingHours || "Ish vaqti"}: {restaurant.openingHours || restaurant.workingHours}
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 shadow-xs">
            <Banknote className="h-4 w-4 text-emerald-600" />
            <span className="text-emerald-700 font-semibold">{locale === "ru" ? "Бесплатная бронь стола" : locale === "en" ? "Free table reservation" : "Bepul stol band qilish"}</span>
          </span>

          {(restaurant.contactPhone || restaurant.phone) && (
            <a
              href={`tel:${(restaurant.contactPhone || restaurant.phone).replace(/\s+/g, "")}`}
              className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200/80 px-2.5 py-1.5 shadow-xs hover:bg-slate-50 transition"
            >
              <Phone className="h-4 w-4 text-slate-400" />
              {restaurant.contactPhone || restaurant.phone}
            </a>
          )}
          {restaurant.menuUrl && (
            <a
              href={restaurant.menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {(dict as any).detail?.viewMenu || (locale === "ru" ? "Посмотреть меню" : locale === "en" ? "View Menu" : "Menyu ko‘rish")}
            </a>
          )}
        </div>
      </header>

      {/* Body Content and Booking Form */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-8">
          {restaurant.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                {(dict as any).detail?.about || "Restoran haqida"}
              </h2>
              <p className="whitespace-pre-line leading-relaxed text-slate-600">
                {restaurant.description}
              </p>
            </section>
          )}

          {/* Restaurant Amenities Section */}
          <RestaurantAmenitiesSection
            amenities={restaurant.amenities}
            title={(dict as any).amenities || "Qulayliklar va xizmatlar"}
          />

          {/* Restaurant Rules Section */}
          <RestaurantRulesSection
            rules={restaurant.rules}
            workingHours={restaurant.workingHours || restaurant.openingHours}
            title={(dict as any).rules || "Restoran tartib-qoidalari va shartlari"}
          />

          <section id="reviews" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <h2 className="text-2xl font-bold text-slate-900">
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

          <section id="location" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <DetailLocationSection 
              title={(dict as any).detail?.location || "Joylashuv"}
              address={restaurant.address || restaurant.cityName} 
              latitude={restaurant.latitude} 
              longitude={restaurant.longitude} 
              itemName={restaurant.name}
              itemImage={restaurant.imageUrl ?? undefined}
              itemRating={restaurant.rating}
              openInMapsText={(dict as any).detail?.openInMaps || "Google Maps'da ochish"}
              noCoordsText={(dict as any).detail?.noCoordinates || "Xarita koordinatalari mavjud emas"}
            />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24">
          <RestaurantBookingSection restaurant={restaurant} dict={dict} isLoggedIn={!!session} />
        </aside>
      </div>
    </main>
  );
}
