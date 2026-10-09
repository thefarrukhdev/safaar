import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/api";
import { AttractionsView } from "@/components/features/attractions/AttractionsView";
import type { AttractionItem } from "@/components/catalog/types";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [commonDict, attractionsDict] = await Promise.all([
    getDictionary(lang as Locale, "common"),
    getDictionary(lang as Locale, "attractions"),
  ]);
  return {
    title: commonDict.nav.attractions,
    description: attractionsDict.subtitle,
  };
}

export default async function AttractionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const [attractionsDict, attractions, heroMap] = await Promise.all([
    getDictionary(locale, "attractions"),
    api.catalog.getAttractions(locale),
    api.heroBackgrounds.getHeroMap(),
  ]);

  const items: AttractionItem[] = attractions.map((item) => ({
    ...item,
    categoryKey: toAttractionCategory(item.categoryKey),
  }));

  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
        <AttractionsView dict={attractionsDict} items={items} locale={locale} />
      </Suspense>
    </main>
  );
}

function toAttractionCategory(value: string): AttractionItem["categoryKey"] {
  if (value === "historical" || value === "unesco" || value === "nature") {
    return value;
  }
  return "historical";
}

