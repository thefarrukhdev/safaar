"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { BookingView } from "@safaar/api-client";
import { api } from "@/lib/api";
import { formatSum } from "@/lib/money";
import { bookingStatusTone, statusBadgeClasses } from "@/lib/bookingStatus";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useRealtime, useRealtimeEvent } from "@/lib/services/realtime/socket-provider";

/**
 * Bronlar ro'yxatining real-time o'rami: hamkor/admin bron holatini
 * o'zgartirsa (tasdiqladi, bekor qildi va h.k.), sahifani yangilamasdan
 * ro'yxat darhol yangilanadi (`booking.status_changed` WebSocket hodisasi).
 */
export function BookingsListLive({
  initialBookings,
  statuses,
  typeLabels,
  viewLabel,
  locale,
  dict,
}: {
  initialBookings: BookingView[];
  statuses: Record<string, string>;
  typeLabels: Record<string, string>;
  viewLabel: string;
  locale: string;
  dict?: any;
}) {
  const [bookings, setBookings] = useState(initialBookings);
  const { accessToken } = useRealtime();

  const refresh = useCallback(() => {
    if (!accessToken) return;
    api.users
      .getMyBookings({ token: accessToken })
      .then(setBookings)
      .catch(() => {});
  }, [accessToken]);

  useRealtimeEvent("booking.status_changed", refresh, [refresh]);

  if (bookings.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 rounded-xl border border-dashed border-slate-900/[0.08]">
        Sizda hali bronlar yo'q
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {bookings.map((booking) => {
        const statusLabel = statuses[booking.status] ?? booking.status;
        const typeLabel = typeLabels[booking.type] ?? booking.type;
        const tone = bookingStatusTone(booking.status);
        return (
          <li key={booking.id}>
            <Card>
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {booking.bookingNumber}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {typeLabel}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses[tone]}`}
                    >
                      {statusLabel}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatSum(booking.totalSum)}
                    </span>
                  </div>
                </div>
                <Link href={`/${locale}/booking/${booking.id}`} className="shrink-0">
                  <Button variant="secondary" className="rounded-full active:scale-[0.97]">{viewLabel}</Button>
                </Link>
              </CardBody>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
