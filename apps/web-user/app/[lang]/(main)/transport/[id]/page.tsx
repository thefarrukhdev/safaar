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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative aspect-[21/9] w-full bg-slate-100 dark:bg-slate-800">
          {transport.imageUrl ? (
            <Image
              src={transport.imageUrl}
              alt={transport.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Car className="h-16 w-16" />
            </div>
          )}
        </div>

        {transport.images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {transport.images.map((img, idx) => (
              <div
                key={idx}
                className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
              >
                <Image
                  src={img}
                  alt={`${transport.name} ${idx + 1}`}
                  fill
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {transport.name}
            </h1>
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
            {transport.seats} o'rin
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
              {transport.luggageCapacityBags} sumka
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
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Transport haqida
            </h2>
            <p className="whitespace-pre-line leading-relaxed text-slate-600 dark:text-slate-300">
              {transport.companyName || "Hamkor"} tomonidan taqdim etiladigan{" "}
              {transport.name}. Kunlik ijaraga olish uchun quyidagi sanalarni tanlang.
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24">
          <TransportBookingSection transport={transport} />
        </aside>
      </div>
    </main>
  );
}
