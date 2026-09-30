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
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 ease-out hover:border-slate-300 sm:flex-row"
          >
            {room.images && room.images.length > 0 && (
              <div className="relative h-48 w-full shrink-0 border-b border-slate-200 sm:h-auto sm:w-56 sm:border-b-0 sm:border-r">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={room.images[0]}
                  alt={room.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            
            <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-medium leading-snug text-slate-900">
                  {room.name}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-200 px-2.5 text-xs font-medium text-slate-500">
                    <Users className="size-4 text-slate-500" aria-hidden="true" />
                    {dict.capacity}: {room.capacity} {dict.guests}
                  </span>

                  {soldOut ? (
                    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-200 px-2.5 text-xs font-medium text-slate-500">
                      <AlertCircle className="size-4 text-slate-500" aria-hidden="true" />
                      {dict.soldOut}
                    </span>
                  ) : (
                    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-slate-200 px-2.5 text-xs font-medium text-slate-500">
                      <CheckCircle2 className="size-4 text-slate-500" aria-hidden="true" />
                      {room.available} {dict.available}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-900/[0.08] pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                <div className="text-left sm:text-right">
                  {room.promotion && (
                    <div className="flex items-center gap-2 sm:justify-end">
                      <span className="text-xs font-normal text-slate-900/50 line-through tabular-nums">
                        {formatSum(room.promotion.oldPriceSum, locale)}
                      </span>
                      <span className="inline-flex h-5 items-center rounded-full bg-red-600/[0.10] px-2 text-xs font-medium text-red-700">
                        -{room.promotion.discountPercent}%
                      </span>
                    </div>
                  )}
                  <span className="text-lg font-semibold tabular-nums text-slate-900">
                    {formatSum(room.promotion ? room.promotion.newPriceSum : room.priceSum, locale)}
                  </span>
                  <span className="text-xs font-normal text-slate-900/70">
                    {" "}
                    / {dict.perNight}
                  </span>
                  {room.promotion && (
                    <div className="text-xs font-normal text-slate-900/50">
                      {dict.discountUntil.replace("{date}", room.promotion.endDate)}
                    </div>
                  )}
                </div>

                {soldOut ? (
                  <span className="text-xs font-medium text-slate-500">{dict.soldOut}</span>
                ) : (
                  <Link
                    href={bookingHref(room.id)}
                    className="inline-flex w-full sm:w-auto h-10 max-md:h-11 items-center justify-center gap-2 px-5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-full active:scale-[0.97] transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none motion-reduce:active:scale-100"
                  >
                    {dict.book}
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
