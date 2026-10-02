import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/api";
import { TransportView } from "@/components/features/transport/TransportView";
import type { TransportItem } from "@/components/catalog/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const [commonDict, transportDict] = await Promise.all([
    getDictionary(lang as Locale, "common"),
    getDictionary(lang as Locale, "transport"),
  ]);
  const transportTitle = (commonDict.nav as typeof commonDict.nav & { transport?: string }).transport ?? "Transport";
  return {
    title: transportTitle,
    description: transportDict.subtitle,
  };
}

export default async function TransportPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const sp = await searchParams;
  const checkIn = sp.checkIn ?? "";
  const checkOut = sp.checkOut ?? "";

  const [transportDict, transports, heroMap] = await Promise.all([
    getDictionary(locale, "transport"),
    api.catalog.getTransports(locale, { checkIn, checkOut }),
    api.heroBackgrounds.getHeroMap(),
  ]);

  const items: TransportItem[] = transports.map((item) => ({
    ...item,
    categoryKey: toTransportCategory(item.categoryKey),
  }));

  const transportHero = heroMap["transport"];
  const heroBg = transportHero ? {
    imageUrl: transportHero.imageUrl,
    title: typeof transportHero.title === "object" ? transportHero.title?.[locale] : transportHero.titleText,
    subtitle: typeof transportHero.subtitle === "object" ? transportHero.subtitle?.[locale] : transportHero.subtitleText,
  } : undefined;

  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="flex h-[300px] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>}>
        <TransportView
          dict={transportDict}
          items={items}
          locale={locale}
          initialCheckIn={checkIn}
          initialCheckOut={checkOut}
          heroBg={heroBg}
        />
      </Suspense>
    </main>
  );
}

function toTransportCategory(value: string): TransportItem["categoryKey"] {
  if (value === "rent" || value === "transfer" || value === "vip") {
    return value;
  }
  return "transfer";
}
