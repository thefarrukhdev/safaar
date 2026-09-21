import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale, "account");
  return { title: dict.nav?.bookings, robots: { index: false, follow: false } };
}
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookingsListLive } from "@/components/features/account/BookingsListLive";
import { CalendarX } from "lucide-react";
import type { BookingView } from "@/types/view";

export default async function AccountBookingsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  // SENIOR OPTIMIZATION: Parallelize session & dictionary loading
  const [session, dict] = await Promise.all([
    getSession(),
    getDictionary(locale, "account"),
  ]);

  if (!session) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/account/bookings`)}`,
    );
  }

  const bookings: BookingView[] = await api.users.getMyBookings({ token: session.accessToken });

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX className="h-10 w-10 text-slate-400 dark:text-slate-500" />}
        title={dict.bookings.empty}
        description={dict.bookings.emptyDescription}
        actionLabel={dict.bookings.emptyAction}
        actionHref={`/${locale}`}
      />
    );
  }

  const statuses = dict.bookings.statuses as Record<string, string>;
  const typeLabels: Record<string, string> = {
    hotel: dict.bookings.hotel,
    bus: dict.bookings.bus,
    restaurant: dict.bookings.restaurant,
  };

  return (
    <BookingsListLive dict={dict}
      initialBookings={bookings}
      statuses={statuses}
      typeLabels={typeLabels}
      viewLabel={dict.bookings.view}
      locale={locale}
    />
  );
}
