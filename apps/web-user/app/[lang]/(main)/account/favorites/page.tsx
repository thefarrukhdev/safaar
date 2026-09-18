import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale, "account");
  return { title: dict.nav?.favorites ?? "Sevimlilar", robots: { index: false, follow: false } };
}
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { api } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { resolveImage } from "@/lib/images";
import { formatSum } from "@/lib/money";
import { Star, Building2, HeartOff } from "lucide-react";
import type { FavoriteView, HotelListItem } from "@/types/view";

export default async function AccountFavoritesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  // SENIOR OPTIMIZATION: Parallelize session & dictionary loading
  const [session, dict, favDict] = await Promise.all([
    getSession(),
    getDictionary(locale, "account"),
    getDictionary(locale, "favorites"),
  ]);

  if (!session) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/account/favorites`)}`,
    );
  }

  const rawFavorites: FavoriteView[] = await api.users.getFavorites({ token: session.accessToken });

  if (rawFavorites.length === 0) {
    return (
      <EmptyState
        icon={<HeartOff className="h-10 w-10 text-slate-400 dark:text-slate-500" />}
        title={dict.favorites.empty}
        description="Siz hali hech qanday mehmonxonani saralanganlarga qo'shmadingiz. Yoqtirgan ob'ektlaringizdagi yurakcha belgisini bosing!"
        actionLabel="Mehmonxonalarni kashf eting"
        actionHref={`/${locale}/hotels`}
      />
    );
  }

  const resolvedItems = await Promise.all(
    rawFavorites.map(async (fav) => {
      if (fav.targetType === "hotel") {
        const realHotel = await api.hotels.getHotel(locale, fav.targetId);
        const item: HotelListItem = {
          id: realHotel.id,
          slug: realHotel.slug,
          name: realHotel.name,
          cityName: realHotel.cityName,
          stars: realHotel.stars,
          rating: realHotel.rating,
          reviewsCount: realHotel.reviewsCount,
          minPriceSum: realHotel.minPriceSum,
          imageUrl: realHotel.images[0] ?? "",
        };
        return { favId: fav.id, hotel: item };
      }

      // Restoran/transportning o'z detail sahifasi bor (bu audit
      // fixidan keyin) — shu sabab ularni ham haqiqiy nom/rasm bilan
      // to'g'ri sahifaga bog'laymiz, xuddi hotel kabi. Boshqa (masalan
      // hali detail sahifasi yo'q) target turlari uchun soxta route
      // YARATILMAYDI — pastdagi bosilmaydigan holatda qoladi.
      if (fav.targetType === "restaurant") {
        try {
          const restaurant = await api.catalog.getRestaurant(fav.targetId, locale);
          return {
            favId: fav.id,
            linked: {
              href: `/${locale}/restaurants/${fav.targetId}`,
              name: restaurant.name,
              subtitle: restaurant.cityName,
              imageUrl: restaurant.imageUrl,
            },
          };
        } catch {
          return { favId: fav.id, targetId: fav.targetId, targetType: fav.targetType };
        }
      }

      if (fav.targetType === "transport" || fav.targetType === "vehicle") {
        try {
          const transport = await api.catalog.getTransport(fav.targetId, locale);
          return {
            favId: fav.id,
            linked: {
              href: `/${locale}/transport/${fav.targetId}`,
              name: transport.name,
              subtitle: transport.cityName,
              imageUrl: transport.imageUrl,
            },
          };
        } catch {
          return { favId: fav.id, targetId: fav.targetId, targetType: fav.targetType };
        }
      }

      return { favId: fav.id, targetId: fav.targetId, targetType: fav.targetType };
    })
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {resolvedItems.map((item) => {
        if ("hotel" in item && item.hotel) {
          const { hotel } = item;
          const imageUrl = resolveImage(hotel.imageUrl);
          return (
            <Link
              key={item.favId}
              href={`/${locale}/hotels/${hotel.slug}`}
              className="group block overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <article className="flex h-full overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
                <div className="relative aspect-square w-32 shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={hotel.name}
                      fill
                      sizes="128px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-primary-400">
                      <Building2 className="h-8 w-8" />
                    </span>
                  )}
                  {hotel.rating > 0 && (
                    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 shadow-sm backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/90 dark:text-amber-400">
                      <Star className="h-3 w-3 fill-current" />
                      {hotel.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <h3 className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-white">
                      {hotel.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{hotel.cityName}</p>
                  </div>

                  <div className="mt-auto">
                    <span className="text-sm font-bold text-primary-700 dark:text-primary-400">
                      {formatSum(hotel.minPriceSum)}
                    </span>
                    <span className="text-[10px] text-slate-400"> / {(favDict as any).perNight || "kecha"}</span>
                  </div>
                </div>
              </article>
            </Link>
          );
        }

        if ("linked" in item && item.linked) {
          const { linked } = item;
          const imageUrl = resolveImage(linked.imageUrl);
          return (
            <Link
              key={item.favId}
              href={linked.href}
              className="group block overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <article className="flex h-full overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
                <div className="relative aspect-square w-32 shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={linked.name}
                      fill
                      sizes="128px"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-primary-400">
                      <Building2 className="h-8 w-8" />
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center p-3">
                  <h3 className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-white">
                    {linked.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{linked.subtitle}</p>
                </div>
              </article>
            </Link>
          );
        }

        // Bu target turi uchun hali haqiqiy detail sahifa yo'q (yoki
        // ma'lumotni olib bo'lmadi) — soxta route yaratmasdan, aniq
        // (bosilmaydigan) holatda ko'rsatamiz.
        return (
          <Card key={item.favId}>
            <CardBody className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {item.targetType}
              </span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {item.targetId}
              </span>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
