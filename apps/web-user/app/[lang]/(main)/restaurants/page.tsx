import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/api";
import { RestaurantsView } from "@/components/features/restaurants/RestaurantsView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [commonDict, restaurantsDict] = await Promise.all([
    getDictionary(lang as Locale, "common"),
    getDictionary(lang as Locale, "restaurants"),
  ]);
  return {
    title: commonDict.nav.restaurants,
    description: restaurantsDict.subtitle,
  };
}

export default async function RestaurantsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const [restaurantsDict, restaurants] = await Promise.all([
    getDictionary(locale, "restaurants"),
    api.catalog.getRestaurants(locale),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      <RestaurantsView dict={restaurantsDict} items={restaurants} locale={locale} />
    </main>
  );
}
