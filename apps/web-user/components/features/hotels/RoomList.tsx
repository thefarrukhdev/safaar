import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { HotelDetailDict } from "@/i18n/dictionaries";
import { formatSum } from "@/lib/money";
import type { RoomTypeView } from "@/types/view";
import { Users, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface RoomSearchContext {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

export function RoomList({
  rooms,
  locale,
  hotelId,
  dict,
  search,
}: {
  rooms: RoomTypeView[];
  locale: Locale;
  hotelId: string;
  dict: HotelDetailDict;
  search?: RoomSearchContext;
}) {
  function bookingHref(roomId: string): string {
    const params = new URLSearchParams({ hotelId, roomId });
    if (search?.checkIn) params.set("checkIn", search.checkIn);
    if (search?.checkOut) params.set("checkOut", search.checkOut);
    if (search?.guests) params.set("guests", String(search.guests));
    return `/${locale}/booking?${params.toString()}`;
  }

  if (rooms.length === 0) {
    return (
      <div className="py-8 text-center text-slate-500 rounded-2xl border border-dashed border-slate-200">
        Boshqa xonalar topilmadi.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rooms.map((room) => {
        const soldOut = room.available <= 0;
        return (
          <li
            key={room.id}
            data-testid="room-card"
            className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-card p-5 shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {room.name}
              </h3>
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200/40 px-2.5 py-0.5 text-xs font-semibold text-slate-650 dark:bg-slate-850 dark:text-slate-350">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {dict.capacity}: {room.capacity} {dict.guests}
                </span>

                {soldOut ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100/50 px-2.5 py-0.5 text-xs font-bold text-red-650 dark:bg-red-950/20 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {dict.soldOut}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100/50 px-2.5 py-0.5 text-xs font-bold text-emerald-650 dark:bg-emerald-950/20 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {room.available} {dict.available}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0 dark:border-slate-800">
              <div className="text-left sm:text-right">
                <span className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white sm:text-xl">
                  {formatSum(room.priceSum)}
                </span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {" "}
                  / {dict.perNight}
                </span>
              </div>

              {soldOut ? (
                <span className="text-xs font-semibold text-slate-400">{dict.soldOut}</span>
              ) : (
                <Link href={bookingHref(room.id)}>
                  <Button variant="primary" size="md">
                    {dict.book}
                  </Button>
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
