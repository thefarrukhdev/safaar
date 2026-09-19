import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { HotelDetailDict } from "@/i18n/dictionaries";
import { formatSum } from "@/lib/money";
import type { RoomTypeView } from "@/types/view";
import { Users, CheckCircle2, AlertCircle } from "lucide-react";

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
      <div className="py-8 text-center text-slate-900/70 rounded-xl border border-dashed border-slate-900/[0.08]">
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
            className="flex flex-col gap-4 rounded-xl border border-slate-900/[0.08] bg-white p-5 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.03] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-medium leading-snug text-slate-900">
                {room.name}
              </h3>
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-900/[0.05] px-2.5 text-xs font-medium text-slate-900/70">
                  <Users className="size-4 text-slate-900/70" aria-hidden="true" />
                  {dict.capacity}: {room.capacity} {dict.guests}
                </span>

                {soldOut ? (
                  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-red-600/[0.10] px-2.5 text-xs font-medium text-red-700">
                    <AlertCircle className="size-4" aria-hidden="true" />
                    {dict.soldOut}
                  </span>
                ) : (
                  <span className="inline-flex h-6 items-center gap-1 rounded-full bg-emerald-600/[0.10] px-2.5 text-xs font-medium text-emerald-800">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {room.available} {dict.available}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-slate-900/[0.08] pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
              <div className="text-left sm:text-right">
                <span className="text-lg font-semibold tabular-nums text-slate-900">
                  {formatSum(room.priceSum)}
                </span>
                <span className="text-xs font-normal text-slate-900/70">
                  {" "}
                  / {dict.perNight}
                </span>
              </div>

              {soldOut ? (
                <span className="text-xs font-medium text-slate-900/70">{dict.soldOut}</span>
              ) : (
                <Link
                  href={bookingHref(room.id)}
                  className="inline-flex h-10 max-md:h-11 items-center justify-center gap-2 rounded-full border border-blue-700/50 bg-blue-600 px-5 text-sm font-medium text-white shadow-emboss-primary transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] active:shadow-emboss-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {dict.book}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
