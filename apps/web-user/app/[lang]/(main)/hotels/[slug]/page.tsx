import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { isLocale, type Locale, locales } from '@/i18n/config';
import { config } from '@/lib/config';
import { getDictionary } from '@/i18n/dictionaries';
import { api, ApiRequestError } from '@/lib/api';
import { getSession } from '@/lib/auth/session';
import { HotelGallery } from '@/components/hotels/HotelGallery';
import { RoomList } from '@/components/hotels/RoomList';
import { HotelMobileCtaBar } from '@/components/hotels/HotelMobileCtaBar';
import { ReviewsList } from '@/components/reviews/ReviewsList';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { HotelBookingWidget } from '@/components/features/hotels/HotelBookingWidget';
import { HotelAmenities } from '@/components/features/hotels/HotelAmenities';
import { HotelStickyNav } from '@/components/features/hotels/HotelStickyNav';
import { HotelLocation } from '@/components/features/hotels/HotelLocation';
import { BackButton } from '@/components/ui/BackButton';
import { Badge } from '@/components/ui/Badge';
import {
  MapPin,
  ShieldCheck,
  Star,
} from 'lucide-react';

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function num(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const getCachedHotel = cache(async (locale: Locale, slug: string) => {
  try {
    return await api.hotels.getHotel(locale, slug);
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.statusCode === 404) {
      return 404 as const;
    }
    throw error;
  }
});

async function getFavoriteIdOrNull(hotelId: string, token?: string) {
  if (!token) return null;

  try {
    return await api.users.findFavoriteId(hotelId, { token });
  } catch (error: unknown) {
    if (error instanceof ApiRequestError) {
      return null;
    }
    throw error;
  }
}

async function getHotelReviewsOrEmpty(hotelId: string) {
  try {
    return await api.reviews.getHotelReviews(hotelId);
  } catch (error: unknown) {
    if (error instanceof ApiRequestError) {
      return [];
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const hotel = await getCachedHotel(locale, slug);
  if (!hotel || hotel === 404) return {};

  const title = `${hotel.name} — Safaar`;
  const description = hotel.description?.slice(0, 160) || `Book ${hotel.name} on Safaar.uz`;
  const url = `${config.siteUrl}/${locale}/hotels/${slug}`;
  const images = hotel.images || [];

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        locales.map((l) => [l, `${config.siteUrl}/${l}/hotels/${slug}`])
      ),
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: images.map(imgUrl => ({ url: imgUrl })),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang, slug } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const sp = await searchParams;

  const [hotel, dict, favDict, reviewsDict, commonDict, session, amenitiesRes] =
    await Promise.all([
      getCachedHotel(locale, slug),
      getDictionary(locale, 'hotelDetail'),
      getDictionary(locale, 'favorites'),
      getDictionary(locale, 'reviews'),
      getDictionary(locale, 'common'),
      getSession(),
      api.catalog.getAmenities(locale),
    ]);

  if (hotel === 404) {
    notFound();
  }

  if (!hotel) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <p className="rounded-xl border border-amber-200 bg-white p-4 text-sm font-medium text-amber-800 shadow-sm">
          {dict.error}
        </p>
      </main>
    );
  }

  const [favoriteId, reviews] = await Promise.all([
    getFavoriteIdOrNull(hotel.id, session?.accessToken),
    getHotelReviewsOrEmpty(hotel.id),
  ]);

  const amenityName = Object.fromEntries(
    amenitiesRes.map((amenity) => [amenity.id, amenity.name]),
  );

  const schema = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: hotel.name,
    description: hotel.description,
    image: hotel.images,
    address: hotel.address ? {
      "@type": "PostalAddress",
      streetAddress: hotel.address,
      addressLocality: hotel.cityName
    } : undefined,
    aggregateRating: (hotel.rating > 0 && hotel.reviewsCount > 0) ? {
      "@type": "AggregateRating",
      ratingValue: hotel.rating,
      reviewCount: hotel.reviewsCount,
    } : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 sm:gap-6 px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-10">
        {/* Back Button */}
        <div className="w-full flex items-center">
          <BackButton />
        </div>

        {/* Gallery */}
        <div id="photos" className="relative">
          <HotelGallery images={hotel.images} alt={hotel.name} />

        {/* Favorite Button - gallery ustida o'ng burchak */}
        <div className="absolute right-4 top-4 z-10">
          <FavoriteButton
            targetType="hotel"
            targetId={hotel.id}
            initialFavoriteId={favoriteId}
            authed={!!session}
            loginHref={`/${locale}/login?next=${encodeURIComponent(
              `/${locale}/hotels/${slug}`,
            )}`}
            dict={favDict}
          />
        </div>
      </div>

      <header className="flex flex-col gap-4 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              {hotel.name}
            </h1>
            <p className="flex items-center gap-1.5 text-base font-medium text-slate-600">
              <MapPin className="h-5 w-5 shrink-0 text-slate-400" />
              {hotel.cityName}
              {hotel.address && <span className="opacity-60">· {hotel.address}</span>}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5">
              {hotel.stars > 0 && (
                <span className="text-xl tracking-widest text-amber-500 drop-shadow-sm">
                  {'★'.repeat(hotel.stars)}
                </span>
              )}
            </div>
            {hotel.rating > 0 && (
              <Badge
                variant="outline"
                className="gap-1.5 border-amber-200 bg-white px-4 py-1.5 text-sm font-extrabold text-amber-700 shadow-sm"
              >
                <Star className="h-4 w-4 fill-current text-amber-500" />
                <span>{hotel.rating.toFixed(1)}</span>
              </Badge>
            )}
          </div>
        </div>
      </header>

      <HotelStickyNav dict={dict.nav} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-0">
          {/* Top Highlights */}
          <section className="flex flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <ul className="flex flex-col gap-4">
              <li className="flex items-center gap-4 text-base text-slate-900">
                <MapPin className="h-6 w-6 text-slate-700" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span className="font-semibold">{dict.highlights.centralLocationTitle}</span>
                  <span className="text-sm text-slate-500">{dict.highlights.centralLocationDesc}</span>
                </div>
              </li>
              <li className="flex items-center gap-4 text-base text-slate-900">
                <ShieldCheck className="h-6 w-6 text-slate-700" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span className="font-semibold">{dict.highlights.freeCancellationTitle}</span>
                  <span className="text-sm text-slate-500">{dict.highlights.freeCancellationDesc}</span>
                </div>
              </li>
              <li className="flex items-center gap-4 text-base text-slate-900">
                <Star className="h-6 w-6 text-slate-700" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span className="font-semibold">{dict.highlights.superbRatingTitle}</span>
                  <span className="text-sm text-slate-500">{dict.highlights.superbRatingDesc}</span>
                </div>
              </li>
            </ul>
          </section>

          {hotel.description && (
            <section className="flex flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
              <h2 className="text-2xl font-bold text-slate-900">
                {dict.about}
              </h2>
              <p className="leading-relaxed text-slate-600">
                {hotel.description}
              </p>
            </section>
          )}

          {hotel.amenities.length > 0 && (
            <section id="amenities" className="scroll-mt-24 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
              <HotelAmenities
                amenities={hotel.amenities}
                amenityName={amenityName}
                dict={dict}
              />
            </section>
          )}

          <section id="rooms" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <h2 className="text-2xl font-bold text-slate-900">
              {dict.rooms.title}
            </h2>
            <RoomList
              rooms={hotel.rooms}
              locale={locale}
              hotelId={hotel.id}
              dict={dict}
              search={{
                checkIn: one(sp.check_in) ?? one(sp.checkIn),
                checkOut: one(sp.check_out) ?? one(sp.checkOut),
                guests: num(one(sp.guests)),
              }}
            />
          </section>

          <section id="reviews" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <h2 className="text-2xl font-bold text-slate-900">
              {dict.reviews}
            </h2>
            <ReviewsList 
              reviews={reviews} 
              dict={reviewsDict} 

              locale={locale} 
              hotelId={hotel.id}
              authed={!!session}
              token={session?.accessToken}
            />
          </section>

          <section id="location" className="flex scroll-mt-24 flex-col gap-4 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
            <h2 className="text-2xl font-bold text-slate-900">{dict.locationTitle}</h2>
            <HotelLocation address={hotel.address} latitude={hotel.latitude} longitude={hotel.longitude} dict={dict.location} />
          </section>
        </div>

        <HotelBookingWidget
          minPriceSum={hotel.minPriceSum}
          checkInTime={hotel.checkInTime}
          checkOutTime={hotel.checkOutTime}
          dict={dict}
          locale={locale}
        />
      </div>

      <HotelMobileCtaBar
        price={hotel.minPriceSum}
        perNightText={dict.perNight}
        buttonText={dict.book}
        targetId="hotel-original-cta"
        locale={locale}
      />
    </main>
    </>
  );
}
