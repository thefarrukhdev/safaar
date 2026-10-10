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
  const heroMap = await api.heroBackgrounds.getHeroMap().catch(() => ({}) as any);
  const heroData = heroMap["attractions"];
  
  const backendTitle = heroData ? (typeof heroData.title === "object" ? heroData.title?.[lang as Locale] : heroData.titleText) : undefined;
  const backendSubtitle = heroData ? (typeof heroData.subtitle === "object" ? heroData.subtitle?.[lang as Locale] : heroData.subtitleText) : undefined;
  
  const title = backendTitle || commonDict.nav.attractions;
  const description = backendSubtitle || attractionsDict.subtitle;

  const metadata: Metadata = {
    title,
    description,
  };

  if (heroData?.imageUrl) {
    metadata.openGraph = {
      images: [{ url: heroData.imageUrl }],
    };
  }

  return metadata;
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

  const heroData = heroMap?.["attractions"];
  const heroTitle = heroData ? (typeof heroData.title === "object" ? heroData.title?.[locale] : heroData.titleText) : undefined;
  const heroSubtitle = heroData ? (typeof heroData.subtitle === "object" ? heroData.subtitle?.[locale] : heroData.subtitleText) : undefined;

  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
        <AttractionsView dict={attractionsDict} items={items} locale={locale} heroBg={heroData ? {...heroData, title: heroTitle, subtitle: heroSubtitle} : undefined} />
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

