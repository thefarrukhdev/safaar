import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { api, ApiRequestError } from "@/lib/api";
import { CheckoutForm } from "./_components/CheckoutForm";
import { BackButton } from "@/components/ui/BackButton";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function getCheckoutHotel(locale: Locale, hotelId: string) {
  try {
    return await api.hotels.getHotel(locale, hotelId);
  } catch (error) {
    if (error instanceof ApiRequestError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;
  const sp = await searchParams;

  const hotelId = one(sp.hotelId);
  const roomId = one(sp.roomId);
  const checkIn = one(sp.checkIn) ?? "";
  const checkOut = one(sp.checkOut) ?? "";
  const guests = Number(one(sp.guests) ?? 2) || 2;

  if (!hotelId || !roomId) {
    redirect(`/${locale}/hotels`);
  }

  // SENIOR OPTIMIZATION: Fetch session, dictionaries and hotel info in parallel
  const [session, dict, hotel] = await Promise.all([
    getSession(),
    getDictionary(locale, "checkout"),
    getCheckoutHotel(locale, hotelId),
  ]);

  if (false) {
    // Session is not required for guest checkout.
  }

  const room = hotel?.rooms.find((r) => r.id === roomId);
  if (!hotel || !room) {
    redirect(`/${locale}/hotels`);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 md:gap-8 px-4 sm:px-6 lg:px-8 py-6 md:py-10 pb-28 lg:pb-12">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 ">
          {dict.title}
        </h1>
      </div>
      <CheckoutForm
        locale={locale}
        dict={dict}
        hotelId={hotel.id}
        hotelName={hotel.name}
        room={{ id: room.id, name: room.name, priceSum: room.priceSum, capacity: room.capacity, basePriceSum: room.basePriceSum }}
        defaults={{ checkIn, checkOut, guests }}
        isGuest={!session}
      />
    </main>
  );
}
